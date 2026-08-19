import type { SupabaseClient } from "@supabase/supabase-js";
import { runWorkflowGraph } from "@/lib/engine/runner";
import { persistRunnerResult } from "@/lib/engine/persist-result";
import type { FlowEdge, FlowNode } from "@/lib/workflow/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

/**
 * Starts a workflow run and persists pause/complete/fail/wait.
 * Used by dashboard actions, inbound email, and cron schedules.
 */
export async function startWorkflowRun(
  supabase: Client,
  options: {
    orgId: string;
    workflowId: string;
    triggerPayload: Record<string, unknown>;
    requestedBy?: string | null;
    dryRun?: boolean;
  }
) {
  const {
    orgId,
    workflowId,
    triggerPayload,
    requestedBy = null,
    dryRun = false,
  } = options;

  const { data: workflow } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .single();

  if (!workflow) throw new Error("Workflow not found");

  const nodes = (workflow.nodes as FlowNode[]) ?? [];
  const edges = (workflow.edges as FlowEdge[]) ?? [];

  const payload = {
    ...triggerPayload,
    ...(dryRun ? { dryRun: true } : {}),
  };

  const { data: execution, error } = await supabase
    .from("workflow_executions")
    .insert({
      workflow_id: workflowId,
      org_id: orgId,
      status: "running",
      trigger_payload: payload,
      logs: [],
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !execution) {
    throw new Error(error?.message ?? "Failed to start execution");
  }

  const result = await runWorkflowGraph({
    nodes,
    edges,
    triggerPayload: {
      ...payload,
      orgId,
    },
    dryRun,
  });

  await persistRunnerResult(supabase, {
    executionId: execution.id,
    orgId,
    result,
    requestedBy,
    workflowNodes: nodes,
  });

  return {
    executionId: execution.id as string,
    status: result.kind,
  };
}

/**
 * Resume a delay-paused execution.
 * Prefer calling after claim_due_delay_executions (already status=running).
 * Falls back to an atomic claim when invoked with a paused id.
 */
export async function resumeWaitingExecution(
  supabase: Client,
  executionId: string,
  options?: { alreadyClaimed?: boolean }
) {
  let execution: Record<string, unknown> | null = null;

  if (options?.alreadyClaimed) {
    const { data } = await supabase
      .from("workflow_executions")
      .select("*, workflows(*)")
      .eq("id", executionId)
      .eq("status", "running")
      .not("waiting_node_id", "is", null)
      .maybeSingle();
    execution = data;
  } else {
    // Atomic claim: only one worker wins
    const { data } = await supabase
      .from("workflow_executions")
      .update({ status: "running" })
      .eq("id", executionId)
      .eq("status", "paused")
      .not("waiting_node_id", "is", null)
      .lte("resume_at", new Date().toISOString())
      .select("*, workflows(*)")
      .maybeSingle();
    execution = data;
  }

  if (!execution || !execution.waiting_node_id) {
    return { skipped: true as const };
  }

  const workflow = execution.workflows as { nodes: unknown; edges: unknown };
  const nodes = (workflow.nodes as FlowNode[]) ?? [];
  const edges = (workflow.edges as FlowEdge[]) ?? [];
  const waitingNodeId = execution.waiting_node_id as string;
  const orgId = execution.org_id as string;
  const triggerPayload =
    (execution.trigger_payload as Record<string, unknown>) ?? {};
  const dryRun = Boolean(triggerPayload.dryRun);

  // Clear wait markers now that we own the resume
  await supabase
    .from("workflow_executions")
    .update({
      resume_at: null,
      waiting_node_id: null,
    })
    .eq("id", executionId)
    .eq("status", "running");

  const existingLogs = (execution.logs as unknown[]) ?? [];
  const result = await runWorkflowGraph({
    nodes,
    edges,
    fromNodeId: waitingNodeId,
    skipCurrent: true,
    triggerPayload,
    dryRun,
    existingLogs: [
      ...(existingLogs as import("@/lib/workflow/types").ExecutionLogEntry[]),
      {
        at: new Date().toISOString(),
        nodeId: waitingNodeId,
        level: "success",
        message: "Delay finished — resuming workflow.",
      },
    ],
  });

  await persistRunnerResult(supabase, {
    executionId,
    orgId,
    result,
    workflowNodes: nodes,
  });

  return { skipped: false as const, status: result.kind };
}
