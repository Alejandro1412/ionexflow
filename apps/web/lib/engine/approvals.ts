import type { SupabaseClient } from "@supabase/supabase-js";
import { runWorkflowGraph } from "@/lib/engine/runner";
import { persistRunnerResult } from "@/lib/engine/persist-result";
import { writeAuditEvent } from "@/lib/audit";
import type { ExecutionLogEntry, FlowEdge, FlowNode } from "@/lib/workflow/types";
import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

export async function applyApprovalDecision(
  supabase: Client,
  options: {
    approvalId: string;
    decision: "approved" | "rejected";
    reviewerId: string | null;
    editedOutput?: string | null;
    source?: string;
  }
) {
  const {
    approvalId,
    decision,
    reviewerId,
    editedOutput = null,
    source = "web",
  } = options;

  const { data: approval } = await supabase
    .from("approvals")
    .select("*")
    .eq("id", approvalId)
    .single();

  if (!approval || approval.status !== "pending") {
    throw new Error("Approval not found or already resolved");
  }

  const trimmedEdit =
    typeof editedOutput === "string" && editedOutput.trim().length > 0
      ? editedOutput.trim()
      : null;

  await supabase
    .from("approvals")
    .update({
      status: decision,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      edited_output: trimmedEdit,
    })
    .eq("id", approvalId);

  const { data: execution } = await supabase
    .from("workflow_executions")
    .select("*, workflows(*)")
    .eq("id", approval.execution_id)
    .single();

  if (!execution) throw new Error("Execution missing");

  const workflow = execution.workflows as { nodes: unknown; edges: unknown };
  const nodes = (workflow.nodes as FlowNode[]) ?? [];
  const edges = (workflow.edges as FlowEdge[]) ?? [];
  const existingLogs = (execution.logs as ExecutionLogEntry[]) ?? [];
  const orgId = execution.org_id as string;
  const payload = (approval.payload ?? {}) as {
    agentOutput?: string | null;
    agentLabel?: string | null;
  };

  await writeAuditEvent({
    orgId,
    actorId: reviewerId,
    action: "approval.resolved",
    targetType: "approval",
    targetId: approvalId,
    meta: { decision, source, edited: Boolean(trimmedEdit) },
  });

  if (decision === "rejected") {
    const logs = [
      ...existingLogs,
      {
        at: new Date().toISOString(),
        nodeId: approval.node_id as string,
        level: "error" as const,
        message: "Approval rejected — execution failed.",
      },
    ];
    await supabase
      .from("workflow_executions")
      .update({
        status: "failed",
        logs,
        completed_at: new Date().toISOString(),
        resume_at: null,
        waiting_node_id: null,
      })
      .eq("id", execution.id);
    return { executionId: execution.id as string };
  }

  const finalOutput = trimmedEdit ?? payload.agentOutput ?? null;
  const resumeLogs: ExecutionLogEntry[] = [
    ...existingLogs,
    {
      at: new Date().toISOString(),
      nodeId: approval.node_id as string,
      level: "success",
      message: trimmedEdit
        ? "Approval granted with edits — resuming workflow."
        : "Approval granted — resuming workflow.",
      kind: finalOutput ? "agent_output" : undefined,
      output: finalOutput ?? undefined,
      provider: trimmedEdit ? "human-edit" : undefined,
    },
  ];

  const triggerPayload = {
    ...((execution.trigger_payload as Record<string, unknown>) ?? {}),
    approvedOutput: finalOutput,
    ...(trimmedEdit ? { editedOutput: trimmedEdit } : {}),
  };

  const result = await runWorkflowGraph({
    nodes,
    edges,
    fromNodeId: approval.node_id as string,
    skipCurrent: true,
    triggerPayload,
    existingLogs: resumeLogs,
  });

  await persistRunnerResult(supabase, {
    executionId: execution.id as string,
    orgId,
    result,
    requestedBy: reviewerId,
    workflowNodes: nodes,
  });

  return { executionId: execution.id as string };
}

export async function resolveApprovalForCurrentUser(
  approvalId: string,
  decision: "approved" | "rejected",
  editedOutput?: string | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return applyApprovalDecision(supabase, {
    approvalId,
    decision,
    reviewerId: user.id,
    editedOutput,
    source: "web",
  });
}
