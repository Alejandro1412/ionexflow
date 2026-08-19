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
  }
) {
  const { orgId, workflowId, triggerPayload, requestedBy = null } = options;

  const { data: workflow } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .single();

  if (!workflow) throw new Error("Workflow not found");

  const nodes = (workflow.nodes as FlowNode[]) ?? [];
  const edges = (workflow.edges as FlowEdge[]) ?? [];

  const { data: execution, error } = await supabase
    .from("workflow_executions")
    .insert({
      workflow_id: workflowId,
      org_id: orgId,
      status: "running",
      trigger_payload: triggerPayload,
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
      ...triggerPayload,
      orgId,
    },
  });

  await persistRunnerResult(supabase, {
    executionId: execution.id,
    orgId,
    result,
    requestedBy,
  });

  return {
    executionId: execution.id as string,
    status: result.kind,
  };
}

/** Resume a delay-paused execution after resume_at. */
export async function resumeWaitingExecution(
  supabase: Client,
  executionId: string
) {
  const { data: execution } = await supabase
    .from("workflow_executions")
    .select("*, workflows(*)")
    .eq("id", executionId)
    .single();

  if (!execution || execution.status !== "paused" || !execution.waiting_node_id) {
    return { skipped: true as const };
  }
  if (execution.resume_at && new Date(execution.resume_at) > new Date()) {
    return { skipped: true as const };
  }

  const workflow = execution.workflows as { nodes: unknown; edges: unknown };
  const nodes = (workflow.nodes as FlowNode[]) ?? [];
  const edges = (workflow.edges as FlowEdge[]) ?? [];
  const waitingNodeId = execution.waiting_node_id as string;
  const orgId = execution.org_id as string;

  await supabase
    .from("workflow_executions")
    .update({
      status: "running",
      resume_at: null,
      waiting_node_id: null,
    })
    .eq("id", executionId);

  const existingLogs = (execution.logs as unknown[]) ?? [];
  const result = await runWorkflowGraph({
    nodes,
    edges,
    fromNodeId: waitingNodeId,
    skipCurrent: true,
    triggerPayload: (execution.trigger_payload as Record<string, unknown>) ?? {},
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
  });

  return { skipped: false as const, status: result.kind };
}
