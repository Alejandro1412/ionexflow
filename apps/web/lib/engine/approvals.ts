import type { SupabaseClient } from "@supabase/supabase-js";
import { runWorkflowGraph } from "@/lib/engine/runner";
import type { ExecutionLogEntry, FlowEdge, FlowNode } from "@/lib/workflow/types";
import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

export async function applyApprovalDecision(
  supabase: Client,
  options: {
    approvalId: string;
    decision: "approved" | "rejected";
    reviewerId: string;
  }
) {
  const { approvalId, decision, reviewerId } = options;

  const { data: approval } = await supabase
    .from("approvals")
    .select("*")
    .eq("id", approvalId)
    .single();

  if (!approval || approval.status !== "pending") {
    throw new Error("Approval not found or already resolved");
  }

  await supabase
    .from("approvals")
    .update({
      status: decision,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
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
      })
      .eq("id", execution.id);
    return { executionId: execution.id as string };
  }

  const result = runWorkflowGraph({
    nodes,
    edges,
    fromNodeId: approval.node_id as string,
    skipCurrent: true,
    triggerPayload: (execution.trigger_payload as Record<string, unknown>) ?? {},
    existingLogs: [
      ...existingLogs,
      {
        at: new Date().toISOString(),
        nodeId: approval.node_id as string,
        level: "success",
        message: "Approval granted — resuming workflow.",
      },
    ],
  });

  if (result.kind === "paused") {
    await supabase
      .from("workflow_executions")
      .update({ status: "paused", logs: result.logs })
      .eq("id", execution.id);
    await supabase.from("approvals").insert({
      execution_id: execution.id,
      org_id: orgId,
      node_id: result.approvalNodeId,
      status: "pending",
      requested_by: reviewerId,
      payload: result.approvalPayload,
    });
  } else if (result.kind === "completed") {
    await supabase
      .from("workflow_executions")
      .update({
        status: "completed",
        logs: result.logs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", execution.id);
  } else {
    await supabase
      .from("workflow_executions")
      .update({
        status: "failed",
        logs: result.logs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", execution.id);
  }

  return { executionId: execution.id as string };
}

export async function resolveApprovalForCurrentUser(
  approvalId: string,
  decision: "approved" | "rejected"
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
  });
}
