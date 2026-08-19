import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { applyApprovalDecision } from "@/lib/engine/approvals";
import { verifyApprovalAction } from "@/lib/approvals/slack-token";

export const runtime = "nodejs";

/**
 * Slack button link target — signed Approve/Reject without requiring Slack OAuth.
 * GET ?a=<approvalId>&d=approved|rejected&e=<unixExp>&s=<hmac>
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const approvalId = url.searchParams.get("a") ?? "";
  const decision = url.searchParams.get("d");
  const exp = Number(url.searchParams.get("e") ?? 0);
  const signature = url.searchParams.get("s") ?? "";

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  if (
    !approvalId ||
    (decision !== "approved" && decision !== "rejected") ||
    !verifyApprovalAction({
      approvalId,
      decision,
      expiresAtUnix: exp,
      signature,
    })
  ) {
    return NextResponse.redirect(`${site}/dashboard/approvals?slack=invalid`);
  }

  try {
    const admin = createServiceRoleClient();
    await applyApprovalDecision(admin, {
      approvalId,
      decision,
      reviewerId: null,
      source: "slack",
    });
    return NextResponse.redirect(
      `${site}/dashboard/approvals?slack=${decision}`
    );
  } catch {
    return NextResponse.redirect(`${site}/dashboard/approvals?slack=error`);
  }
}
