import { createServiceRoleClient } from "@/lib/supabase/server";

export type NotifyApprovalInput = {
  orgId: string;
  approvalId: string;
  executionId: string;
  title?: string;
  body?: string;
  agentPreview?: string | null;
};

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

async function sendResendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: false as const, reason: "no_key" };

  const from =
    process.env.RESEND_FROM?.trim() || "IonexFlow <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("[notify] Resend error", res.status, detail);
      return { sent: false as const, reason: "api_error" };
    }
    return { sent: true as const };
  } catch (error) {
    console.error("[notify] Resend exception", error);
    return { sent: false as const, reason: "exception" };
  }
}

/**
 * Fan-out in-app notifications (+ optional Resend email) when an approval is created.
 * Never throws — workflow must not fail because of notify.
 */
export async function notifyApprovalCreated(input: NotifyApprovalInput) {
  try {
    const admin = createServiceRoleClient();
    const href = `/dashboard/approvals`;
    const title = input.title ?? "Approval needed";
    const preview = (input.agentPreview ?? "").trim().slice(0, 280);
    const body =
      input.body ??
      (preview
        ? `A workflow is waiting for your decision.\n\n${preview}`
        : "A workflow is waiting for your decision.");

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id")
      .eq("org_id", input.orgId);

    if (profilesError || !profiles?.length) {
      console.error("[notify] profiles", profilesError?.message);
      return;
    }

    const rows = profiles.map((p) => ({
      org_id: input.orgId,
      user_id: p.id,
      type: "approval_pending" as const,
      title,
      body,
      href,
      meta: {
        approvalId: input.approvalId,
        executionId: input.executionId,
      },
    }));

    const { error: insertError } = await admin.from("notifications").insert(rows);
    if (insertError) {
      console.error("[notify] insert", insertError.message);
    }

    if (!process.env.RESEND_API_KEY?.trim()) return;

    const approveUrl = `${siteUrl()}/dashboard/approvals`;
    const html = `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
        <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;margin:0 0 8px">IonexFlow</p>
        <h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(title)}</h1>
        <p style="line-height:1.55;color:#334155;white-space:pre-wrap">${escapeHtml(body)}</p>
        <p style="margin:28px 0 0">
          <a href="${approveUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">
            Review approval
          </a>
        </p>
        <p style="margin-top:24px;font-size:12px;color:#94a3b8">You received this because an IonexFlow workflow paused for human review.</p>
      </div>
    `;

    for (const profile of profiles) {
      const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
      const email = authUser.user?.email;
      if (!email) continue;
      await sendResendEmail({
        to: email,
        subject: `[IonexFlow] ${title}`,
        html,
        text: `${title}\n\n${body}\n\nOpen: ${approveUrl}`,
      });
    }
  } catch (error) {
    console.error("[notify] unexpected", error);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
