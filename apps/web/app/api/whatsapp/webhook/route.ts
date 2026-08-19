import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { processInboundWhatsApp } from "@/actions/whatsapp";
import {
  allowRateLimit,
  clientIpFromRequest,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Meta WhatsApp Cloud API webhook.
 * GET: hub.challenge verification using connection verify_token (or WHATSAPP_VERIFY_TOKEN).
 * POST: inbound text messages → startWorkflowRun
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return NextResponse.json({ error: "Bad verify request" }, { status: 400 });
  }

  const envToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (envToken && token === envToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("whatsapp_connections")
    .select("id")
    .eq("verify_token", token)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (data) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  if (!allowRateLimit(`wa-inbound:${ip}`, { limit: 120, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string };
          messages?: Array<{
            from?: string;
            id?: string;
            type?: string;
            text?: { body?: string };
          }>;
        };
      }>;
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const results: Array<{ ok: boolean; executionId?: string; error?: string }> =
    [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      for (const msg of value?.messages ?? []) {
        if (msg.type && msg.type !== "text") continue;
        const text = msg.text?.body?.trim();
        const from = msg.from?.trim();
        if (!text || !from) continue;
        const r = await processInboundWhatsApp({
          phoneNumberId,
          from,
          text,
          messageId: msg.id,
        });
        results.push(r);
      }
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
