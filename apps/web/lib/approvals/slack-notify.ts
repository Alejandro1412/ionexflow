import { buildSlackApprovalLinks } from "@/lib/approvals/slack-token";

export async function postSlackApprovalMessage(options: {
  webhookUrl: string;
  title: string;
  preview?: string | null;
  approvalId: string;
}) {
  const links = buildSlackApprovalLinks(options.approvalId);
  const preview = (options.preview ?? "").trim().slice(0, 500);
  const text = `*IonexFlow — ${options.title}*\n${preview || "A workflow is waiting for approval."}`;

  const body = {
    text,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve" },
            style: "primary",
            url: links.approveUrl,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Reject" },
            style: "danger",
            url: links.rejectUrl,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Open inbox" },
            url: links.dashboardUrl,
          },
        ],
      },
    ],
  };

  const res = await fetch(options.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Slack webhook ${res.status}: ${detail.slice(0, 200)}`);
  }
}
