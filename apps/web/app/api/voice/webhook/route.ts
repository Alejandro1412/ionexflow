import { NextResponse } from "next/server";
import { processInboundVoice } from "@/actions/voice";
import {
  allowRateLimit,
  clientIpFromRequest,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Voice inbound webhook (Twilio-style compatible).
 * Auth: ?token=<inbound_token> or header x-voice-token / Authorization Bearer.
 * Body: JSON or form — SpeechResult / TranscriptionText / transcript, From, CallSid.
 */
export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  if (!allowRateLimit(`voice:${ip}`, { limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const url = new URL(request.url);
  const headerToken =
    request.headers.get("x-voice-token") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  const token =
    url.searchParams.get("token")?.trim() ||
    headerToken.trim() ||
    process.env.VOICE_WEBHOOK_SECRET?.trim() ||
    "";

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  let transcript = "";
  let fromPhone: string | null = null;
  let callSid: string | null = null;

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    transcript = String(
      body.transcript ??
        body.SpeechResult ??
        body.TranscriptionText ??
        body.text ??
        ""
    );
    fromPhone = body.From ? String(body.From) : body.from ? String(body.from) : null;
    callSid = body.CallSid
      ? String(body.CallSid)
      : body.callSid
        ? String(body.callSid)
        : null;
  } else {
    const form = await request.formData();
    transcript = String(
      form.get("transcript") ??
        form.get("SpeechResult") ??
        form.get("TranscriptionText") ??
        form.get("text") ??
        ""
    );
    fromPhone = String(form.get("From") ?? form.get("from") ?? "") || null;
    callSid = String(form.get("CallSid") ?? form.get("callSid") ?? "") || null;
  }

  // Env secret alone is not enough without org token — require connection token
  // unless VOICE_WEBHOOK_SECRET matches AND ?orgId + workflow are provided (skip for MVP: connection token only)
  const result = await processInboundVoice({
    inboundToken: token,
    transcript,
    fromPhone,
    callSid,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Twilio expects TwiML sometimes; JSON is fine for custom STT bridges
  const wantsTwiml = contentType.includes("application/x-www-form-urlencoded");
  if (wantsTwiml) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Got it. We are processing your request.</Say></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  }

  return NextResponse.json({
    ok: true,
    executionId: result.executionId,
  });
}
