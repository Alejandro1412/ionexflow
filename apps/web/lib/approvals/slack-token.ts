import { createHmac, timingSafeEqual } from "crypto";

function secret() {
  return (
    process.env.SLACK_APPROVAL_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

export function signApprovalAction(
  approvalId: string,
  decision: "approved" | "rejected",
  expiresAtUnix: number
) {
  const s = secret();
  if (!s) throw new Error("No signing secret for Slack approval links");
  const payload = `${approvalId}:${decision}:${expiresAtUnix}`;
  return createHmac("sha256", s).update(payload).digest("hex");
}

export function verifyApprovalAction(options: {
  approvalId: string;
  decision: "approved" | "rejected";
  expiresAtUnix: number;
  signature: string;
}) {
  const s = secret();
  if (!s) return false;
  if (Date.now() / 1000 > options.expiresAtUnix) return false;
  const expected = signApprovalAction(
    options.approvalId,
    options.decision,
    options.expiresAtUnix
  );
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(options.signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildSlackApprovalLinks(approvalId: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
  const approveSig = signApprovalAction(approvalId, "approved", exp);
  const rejectSig = signApprovalAction(approvalId, "rejected", exp);
  return {
    approveUrl: `${base}/api/approvals/slack-resolve?a=${approvalId}&d=approved&e=${exp}&s=${approveSig}`,
    rejectUrl: `${base}/api/approvals/slack-resolve?a=${approvalId}&d=rejected&e=${exp}&s=${rejectSig}`,
    dashboardUrl: `${base}/dashboard/approvals`,
  };
}
