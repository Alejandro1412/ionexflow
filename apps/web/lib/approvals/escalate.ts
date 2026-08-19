import { createServiceRoleClient } from "@/lib/supabase/server";
import { notifyApprovalCreated } from "@/lib/notifications/notify";
import { postSlackApprovalMessage } from "@/lib/approvals/slack-notify";
import { writeAuditEvent } from "@/lib/audit";

/**
 * Claim due SLA approvals and notify (in-app + Slack). Marks escalated_at via RPC.
 */
export async function escalateDueApprovals(admin = createServiceRoleClient()) {
  const summary = { escalated: 0, errors: [] as string[] };

  const { data: claimed, error } = await admin.rpc(
    "claim_due_approval_escalations",
    { p_limit: 25 }
  );

  if (error) {
    summary.errors.push(error.message);
    return summary;
  }

  for (const approval of claimed ?? []) {
    try {
      const payload = (approval.payload ?? {}) as {
        label?: string;
        agentOutput?: string | null;
        slackWebhook?: string | null;
      };

      await notifyApprovalCreated({
        orgId: approval.org_id,
        approvalId: approval.id,
        executionId: approval.execution_id,
        title: `SLA escalation: ${payload.label ?? "Approval"}`,
        body: "This approval passed its SLA without a decision. Please review now.",
        agentPreview: payload.agentOutput ?? null,
      });

      const { data: org } = await admin
        .from("organizations")
        .select("approval_slack_webhook")
        .eq("id", approval.org_id)
        .maybeSingle();

      const webhook =
        payload.slackWebhook?.trim() ||
        (org as { approval_slack_webhook?: string | null } | null)
          ?.approval_slack_webhook?.trim() ||
        null;

      if (webhook) {
        await postSlackApprovalMessage({
          webhookUrl: webhook,
          title: `SLA: ${payload.label ?? "Approval needed"}`,
          preview: payload.agentOutput,
          approvalId: approval.id,
        });
      }

      await writeAuditEvent({
        orgId: approval.org_id,
        action: "approval.escalated",
        targetType: "approval",
        targetId: approval.id,
        meta: { executionId: approval.execution_id },
      });

      summary.escalated += 1;
    } catch (err) {
      summary.errors.push(
        `escalation ${approval.id}: ${
          err instanceof Error ? err.message : "fail"
        }`
      );
    }
  }

  return summary;
}
