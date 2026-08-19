import { createServiceRoleClient } from "@/lib/supabase/server";

export type AuditAction =
  | "invite.created"
  | "invite.revoked"
  | "billing.checkout"
  | "billing.portal"
  | "billing.dev_activate"
  | "workflow.saved"
  | "workflow.deleted"
  | "workflow.restored"
  | "mailbox.connected"
  | "mailbox.disconnected"
  | "approval.resolved"
  | "approval.escalated"
  | "execution.started";

export async function writeAuditEvent(options: {
  orgId: string;
  actorId?: string | null;
  action: AuditAction | string;
  targetType?: string;
  targetId?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    const admin = createServiceRoleClient();
    await admin.from("org_audit_events").insert({
      org_id: options.orgId,
      actor_id: options.actorId ?? null,
      action: options.action,
      target_type: options.targetType ?? null,
      target_id: options.targetId ?? null,
      meta: options.meta ?? {},
    });
  } catch (error) {
    console.error("[audit]", error);
  }
}
