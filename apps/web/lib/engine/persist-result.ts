import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyApprovalCreated } from "@/lib/notifications/notify";
import { postSlackApprovalMessage } from "@/lib/approvals/slack-notify";
import type { RunnerResult } from "@/lib/engine/runner";
import type { FlowNode, FlowNodeData } from "@/lib/workflow/types";

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
    workflowNodes?: FlowNode[];
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

    const node = options.workflowNodes?.find(
      (n) => n.id === result.approvalNodeId
    );
    const nodeData = node?.data as FlowNodeData | undefined;
    const slaMinutes = Math.max(
      0,
      Math.min(10080, Number(nodeData?.slaMinutes ?? 0) || 0)
    );
    const escalateAt =
      slaMinutes > 0
        ? new Date(Date.now() + slaMinutes * 60_000).toISOString()
        : null;

    const { data: approval } = await supabase
      .from("approvals")
      .insert({
        execution_id: executionId,
        org_id: orgId,
        node_id: result.approvalNodeId,
        status: "pending",
        requested_by: requestedBy,
        payload: {
          ...result.approvalPayload,
          slaMinutes: slaMinutes || null,
          slackWebhook:
            nodeData?.approvalSlackWebhook?.trim() ||
            (result.approvalPayload as { slackWebhook?: string }).slackWebhook ||
            null,
        },
        escalate_at: escalateAt,
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

      // Slack Approve/Reject buttons (node webhook or org default)
      try {
        const { data: org } = await supabase
          .from("organizations")
          .select("approval_slack_webhook")
          .eq("id", orgId)
          .maybeSingle();
        const webhook =
          nodeData?.approvalSlackWebhook?.trim() ||
          (org as { approval_slack_webhook?: string | null } | null)
            ?.approval_slack_webhook?.trim() ||
          null;
        if (webhook) {
          await postSlackApprovalMessage({
            webhookUrl: webhook,
            title: payload.label ?? "Approval needed",
            preview: payload.agentOutput,
            approvalId: approval.id,
          });
        }
      } catch (error) {
        console.error("[persist] slack approval notify", error);
      }
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
