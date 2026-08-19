import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyApprovalCreated } from "@/lib/notifications/notify";
import type { RunnerResult } from "@/lib/engine/runner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;

/** Persist runner outcome onto an existing execution row. */
export async function persistRunnerResult(
  supabase: Client,
  options: {
    executionId: string;
    orgId: string;
    result: RunnerResult;
    requestedBy?: string | null;
  }
) {
  const { executionId, orgId, result, requestedBy = null } = options;

  if (result.kind === "waiting") {
    await supabase
      .from("workflow_executions")
      .update({
        status: "paused",
        logs: result.logs,
        resume_at: result.resumeAt,
        waiting_node_id: result.waitingNodeId,
      })
      .eq("id", executionId);
    return;
  }

  if (result.kind === "paused") {
    await supabase
      .from("workflow_executions")
      .update({
        status: "paused",
        logs: result.logs,
        resume_at: null,
        waiting_node_id: null,
      })
      .eq("id", executionId);

    const { data: approval } = await supabase
      .from("approvals")
      .insert({
        execution_id: executionId,
        org_id: orgId,
        node_id: result.approvalNodeId,
        status: "pending",
        requested_by: requestedBy,
        payload: result.approvalPayload,
      })
      .select("id")
      .single();

    if (approval?.id) {
      const payload = result.approvalPayload as {
        label?: string;
        agentOutput?: string | null;
      };
      await notifyApprovalCreated({
        orgId,
        approvalId: approval.id,
        executionId,
        title: payload.label
          ? `Approval: ${payload.label}`
          : "Approval needed",
        agentPreview: payload.agentOutput ?? null,
      });
    }
    return;
  }

  if (result.kind === "completed") {
    await supabase
      .from("workflow_executions")
      .update({
        status: "completed",
        logs: result.logs,
        completed_at: new Date().toISOString(),
        resume_at: null,
        waiting_node_id: null,
      })
      .eq("id", executionId);
    return;
  }

  await supabase
    .from("workflow_executions")
    .update({
      status: "failed",
      logs: result.logs,
      completed_at: new Date().toISOString(),
      resume_at: null,
      waiting_node_id: null,
    })
    .eq("id", executionId);
}
