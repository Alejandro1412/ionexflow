"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { startWorkflowRun } from "@/lib/engine/start-run";
import { writeAuditEvent } from "@/lib/audit";

export type VoiceActionState = { ok?: boolean; error?: string };

async function requireOrg() {
  const session = await getSessionProfile();
  if (!session?.org) throw new Error("Not authenticated");
  if (!hasProductAccess(session.org.plan_status)) {
    throw new Error("Upgrade required");
  }
  return session;
}

export async function upsertVoiceConnection(
  _prev: VoiceActionState | null,
  formData: FormData
): Promise<VoiceActionState> {
  try {
    const session = await requireOrg();
    const supabase = await createClient();
    const display_name =
      String(formData.get("display_name") ?? "").trim() || "Voice inbound";
    const default_workflow_id =
      String(formData.get("default_workflow_id") ?? "").trim() || null;

    if (!default_workflow_id) {
      return { ok: false, error: "Select a default workflow" };
    }

    const { data: existing } = await supabase
      .from("voice_connections")
      .select("id")
      .eq("org_id", session.org!.id)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from("voice_connections")
        .update({
          display_name,
          default_workflow_id,
          status: "active",
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from("voice_connections").insert({
        org_id: session.org!.id,
        display_name,
        default_workflow_id,
        status: "active",
      });
      if (error) return { ok: false, error: error.message };
    }

    await writeAuditEvent({
      orgId: session.org!.id,
      actorId: session.profile.id,
      action: "voice.connected",
      targetType: "voice_connection",
      meta: { display_name },
    });

    revalidatePath("/dashboard/integrations");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed",
    };
  }
}

export async function processInboundVoice(options: {
  inboundToken: string;
  transcript: string;
  fromPhone?: string | null;
  callSid?: string | null;
}) {
  const admin = createServiceRoleClient();
  const transcript = options.transcript.trim();
  if (!transcript) {
    return { ok: false as const, error: "Empty transcript" };
  }

  const { data: connection } = await admin
    .from("voice_connections")
    .select("*")
    .eq("inbound_token", options.inboundToken)
    .eq("status", "active")
    .maybeSingle();

  if (!connection?.default_workflow_id) {
    return { ok: false as const, error: "Unknown or unconfigured voice token" };
  }

  const { data: call } = await admin
    .from("voice_calls")
    .insert({
      org_id: connection.org_id,
      connection_id: connection.id,
      from_phone: options.fromPhone ?? null,
      call_sid: options.callSid ?? null,
      transcript,
      status: "received",
    })
    .select("id")
    .single();

  const run = await startWorkflowRun(admin, {
    orgId: connection.org_id,
    workflowId: connection.default_workflow_id,
    triggerPayload: {
      input: transcript,
      channel: "voice",
      from: options.fromPhone ?? "",
      body: transcript,
      callSid: options.callSid ?? null,
      voiceConnectionId: connection.id,
      startedBy: "voice-webhook",
      orgId: connection.org_id,
    },
  });

  if (call?.id) {
    await admin
      .from("voice_calls")
      .update({ execution_id: run.executionId, status: "processed" })
      .eq("id", call.id);
  }

  return { ok: true as const, executionId: run.executionId };
}
