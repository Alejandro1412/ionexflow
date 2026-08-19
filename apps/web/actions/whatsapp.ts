"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { encryptWhatsAppToken } from "@/lib/whatsapp/cloud";
import { startWorkflowRun } from "@/lib/engine/start-run";
import { writeAuditEvent } from "@/lib/audit";

export type WhatsAppActionState = { ok?: boolean; error?: string };

async function requireOrg() {
  const session = await getSessionProfile();
  if (!session?.org) throw new Error("Not authenticated");
  if (!hasProductAccess(session.org.plan_status)) {
    throw new Error("Upgrade required");
  }
  return session;
}

export async function connectWhatsApp(
  _prev: WhatsAppActionState | null,
  formData: FormData
): Promise<WhatsAppActionState> {
  try {
    const session = await requireOrg();
    const supabase = await createClient();
    const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim();
    const accessToken = String(formData.get("accessToken") ?? "").trim();
    const displayName =
      String(formData.get("displayName") ?? "").trim() || "WhatsApp Business";
    const workflowId = String(formData.get("workflowId") ?? "") || null;
    const verifyToken =
      String(formData.get("verifyToken") ?? "").trim() ||
      randomBytes(16).toString("hex");

    if (!phoneNumberId || !accessToken) {
      return { ok: false, error: "Phone Number ID and Access Token are required" };
    }

    const { data: existing } = await supabase
      .from("whatsapp_connections")
      .select("id")
      .eq("org_id", session.org!.id)
      .maybeSingle();

    const payload = {
      org_id: session.org!.id,
      status: "active",
      display_name: displayName,
      phone_number_id: phoneNumberId,
      access_token: encryptWhatsAppToken(accessToken),
      verify_token: verifyToken,
      default_workflow_id: workflowId,
      connected_at: new Date().toISOString(),
      last_error: null,
      meta: { provider: "meta_cloud" },
    };

    if (existing?.id) {
      await supabase
        .from("whatsapp_connections")
        .update(payload)
        .eq("id", existing.id);
    } else {
      await supabase.from("whatsapp_connections").insert(payload);
    }

    await writeAuditEvent({
      orgId: session.org!.id,
      actorId: session.profile.id,
      action: "whatsapp.connected",
      targetType: "whatsapp_connection",
      meta: { phoneNumberId },
    });

    revalidatePath("/dashboard/integrations");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Connect failed",
    };
  }
}

export async function disconnectWhatsApp(connectionId: string) {
  const session = await requireOrg();
  const supabase = await createClient();
  await supabase
    .from("whatsapp_connections")
    .update({
      status: "disconnected",
      access_token: null,
      connected_at: null,
      last_error: null,
    })
    .eq("id", connectionId)
    .eq("org_id", session.org!.id);
  await writeAuditEvent({
    orgId: session.org!.id,
    actorId: session.profile.id,
    action: "whatsapp.disconnected",
    targetType: "whatsapp_connection",
    targetId: connectionId,
  });
  revalidatePath("/dashboard/integrations");
}

export async function updateWhatsAppSettings(formData: FormData) {
  const session = await requireOrg();
  const supabase = await createClient();
  const connectionId = String(formData.get("connectionId") ?? "");
  const workflowId = String(formData.get("workflowId") ?? "") || null;
  if (!connectionId) throw new Error("Missing connection");
  await supabase
    .from("whatsapp_connections")
    .update({ default_workflow_id: workflowId })
    .eq("id", connectionId)
    .eq("org_id", session.org!.id);
  revalidatePath("/dashboard/integrations");
}

export async function processInboundWhatsApp(options: {
  phoneNumberId: string;
  from: string;
  text: string;
  messageId?: string;
}) {
  const admin = createServiceRoleClient();
  const { data: connection } = await admin
    .from("whatsapp_connections")
    .select("*")
    .eq("phone_number_id", options.phoneNumberId)
    .eq("status", "active")
    .maybeSingle();

  if (!connection?.default_workflow_id) {
    return { ok: false as const, error: "No active WhatsApp workflow" };
  }

  const triggerPayload = {
    input: `WhatsApp from ${options.from}\n\n${options.text}`,
    channel: "whatsapp",
    startedBy: "whatsapp-inbound",
    orgId: connection.org_id,
    whatsappConnectionId: connection.id,
    whatsapp: {
      from: options.from,
      body: options.text,
      messageId: options.messageId,
    },
    from: options.from,
    body: options.text,
    to: options.from,
  };

  const { data: message } = await admin
    .from("whatsapp_messages")
    .insert({
      org_id: connection.org_id,
      connection_id: connection.id,
      direction: "inbound",
      from_phone: options.from,
      body_text: options.text,
      wa_message_id: options.messageId ?? null,
      status: "received",
    })
    .select("id")
    .single();

  const { executionId } = await startWorkflowRun(admin, {
    orgId: connection.org_id,
    workflowId: connection.default_workflow_id,
    triggerPayload,
  });

  if (message?.id) {
    await admin
      .from("whatsapp_messages")
      .update({ execution_id: executionId, status: "processed" })
      .eq("id", message.id);
  }

  return { ok: true as const, executionId };
}
