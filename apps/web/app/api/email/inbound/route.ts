import { NextResponse } from "next/server";
import { processInboundEmailPayload } from "@/actions/email";

/**
 * Inbound email webhook for enterprise mail automation.
 *
 * POST JSON:
 * { "token": "<inbound_token>", "from": "...", "subject": "...", "body": "..." }
 *
 * Optional header: x-ionex-email-secret === EMAIL_INBOUND_SECRET
 */
export async function POST(request: Request) {
  const secret = process.env.EMAIL_INBOUND_SECRET?.trim();
  if (secret) {
    const header = request.headers.get("x-ionex-email-secret");
    if (header !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let json: Record<string, unknown>;
  try {
    json = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = String(json.token ?? "").trim();
  const from = String(json.from ?? "").trim();
  const subject = String(json.subject ?? "(no subject)").trim();
  const body = String(json.body ?? json.text ?? "").trim();
  const to = json.to ? String(json.to) : undefined;
  const threadId = json.threadId ? String(json.threadId) : undefined;

  if (!token || !from || !body) {
    return NextResponse.json(
      { error: "token, from, and body are required" },
      { status: 400 }
    );
  }

  const result = await processInboundEmailPayload({
    token,
    from,
    to,
    subject,
    body,
    threadId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    executionId: result.executionId,
  });
}
