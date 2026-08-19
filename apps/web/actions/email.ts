"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { startWorkflowRun } from "@/lib/engine/start-run";
import { MAIL_PRESETS, type MailPresetKey } from "@/lib/email/presets";
import { verifyImap, fetchUnseenMail } from "@/lib/email/imap";
import { verifySmtp } from "@/lib/email/smtp";
import { rowToCredentials } from "@/lib/email/send";
import { encryptSecret } from "@/lib/email/crypto";

export type EmailActionState = { ok?: boolean; error?: string; synced?: number };

async function requireOrg() {
  const session = await getSessionProfile();
  if (!session?.org) throw new Error("Not authenticated");
  if (!hasProductAccess(session.org.plan_status)) {
    throw new Error("Upgrade required");
  }
  return session;
}

function providerFromPreset(preset: MailPresetKey): "gmail" | "outlook" | "imap" {
  if (preset === "gmail") return "gmail";
  if (preset === "outlook") return "outlook";
  return "imap";
}

export async function connectMailbox(
  _prev: EmailActionState | null,
  formData: FormData
): Promise<EmailActionState> {
  try {
    const session = await requireOrg();
    const supabase = await createClient();

    const preset = (String(formData.get("preset") || "custom") ||
      "custom") as MailPresetKey;
    const emailAddress = String(formData.get("emailAddress") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim() || emailAddress;
    const password = String(formData.get("password") ?? "");
    const imapHost = String(formData.get("imapHost") ?? "").trim();
    const smtpHost = String(formData.get("smtpHost") ?? "").trim();
    const imapPort = Number(formData.get("imapPort") ?? 993);
    const smtpPort = Number(formData.get("smtpPort") ?? 465);
    const imapSecure = String(formData.get("imapSecure") ?? "true") === "true";
    const smtpSecure = String(formData.get("smtpSecure") ?? "true") === "true";
    const workflowId = String(formData.get("workflowId") ?? "") || null;
    const forwardTo = String(formData.get("forwardTo") ?? "").trim() || null;

    if (!emailAddress || !password || !imapHost || !smtpHost) {
      return {
        ok: false,
        error: "Email, password, IMAP host and SMTP host are required",
      };
    }

    const credentials = {
      emailAddress,
      username,
      password,
      imapHost,
      imapPort,
      imapSecure,
      smtpHost,
      smtpPort,
      smtpSecure,
    };

    const imapCheck = await verifyImap(credentials);
    if (!imapCheck.ok) {
      return { ok: false, error: `IMAP failed: ${imapCheck.error}` };
    }

    const smtpCheck = await verifySmtp(credentials);
    if (!smtpCheck.ok) {
      return { ok: false, error: `SMTP failed: ${smtpCheck.error}` };
    }

    const provider = providerFromPreset(preset);
    const display =
      MAIL_PRESETS[preset]?.label ?? "Mailbox";

    const { data: existing } = await supabase
      .from("email_connections")
      .select("id")
      .eq("org_id", session.org!.id)
      .eq("provider", provider)
      .maybeSingle();

    const payload = {
      org_id: session.org!.id,
      provider,
      status: "active" as const,
      display_name: display,
      email_address: emailAddress,
      username,
      password: encryptSecret(password),
      imap_host: imapHost,
      imap_port: imapPort,
      imap_secure: imapSecure,
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_secure: smtpSecure,
      default_workflow_id: workflowId,
      forward_to: forwardTo,
      connected_at: new Date().toISOString(),
      last_error: null,
      meta: { preset, verifiedAt: new Date().toISOString(), encrypted: true },
    };

    if (existing?.id) {
      await supabase.from("email_connections").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("email_connections").insert(payload);
    }

    revalidatePath("/dashboard/integrations");
    const { writeAuditEvent } = await import("@/lib/audit");
    await writeAuditEvent({
      orgId: session.org!.id,
      actorId: session.profile.id,
      action: "mailbox.connected",
      targetType: "email_connection",
      meta: { email: emailAddress, provider },
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Connect failed",
    };
  }
}

export async function disconnectMailbox(connectionId: string) {
  const session = await requireOrg();
  const supabase = await createClient();
  await supabase
    .from("email_connections")
    .update({
      status: "disconnected",
      connected_at: null,
      password: null,
      last_error: null,
    })
    .eq("id", connectionId)
    .eq("org_id", session.org!.id);
  const { writeAuditEvent } = await import("@/lib/audit");
  await writeAuditEvent({
    orgId: session.org!.id,
    actorId: session.profile.id,
    action: "mailbox.disconnected",
    targetType: "email_connection",
    targetId: connectionId,
  });
  revalidatePath("/dashboard/integrations");
}

export async function updateEmailConnectionSettings(formData: FormData) {
  const session = await requireOrg();
  const supabase = await createClient();
  const connectionId = String(formData.get("connectionId") ?? "");
  const workflowId = String(formData.get("workflowId") ?? "") || null;
  const forwardTo = String(formData.get("forwardTo") ?? "").trim() || null;
  const emailAddress = String(formData.get("emailAddress") ?? "").trim() || null;
  const autoSync = String(formData.get("autoSync") ?? "") === "on";

  if (!connectionId) throw new Error("Missing connection");

  await supabase
    .from("email_connections")
    .update({
      default_workflow_id: workflowId,
      forward_to: forwardTo,
      email_address: emailAddress,
      auto_sync: autoSync,
    })
    .eq("id", connectionId)
    .eq("org_id", session.org!.id);

  revalidatePath("/dashboard/integrations");
}

/**
 * Pull unseen mail from IMAP and start the linked workflow for each message.
 */
export async function syncMailboxNow(
  _prev: EmailActionState | null,
  formData: FormData
): Promise<EmailActionState> {
  try {
    const session = await requireOrg();
    const supabase = await createClient();
    const connectionId = String(formData.get("connectionId") ?? "");

    const { data: connection } = await supabase
      .from("email_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("org_id", session.org!.id)
      .single();

    if (!connection || connection.status !== "active") {
      return { ok: false, error: "Active mailbox required" };
    }
    if (!connection.default_workflow_id) {
      return { ok: false, error: "Link a default workflow first" };
    }

    const credentials = rowToCredentials(connection);
    if (!credentials) {
      return { ok: false, error: "Mailbox credentials incomplete — reconnect" };
    }

    const fetched = await fetchUnseenMail(credentials, 15);
    if (!fetched.ok) {
      await supabase
        .from("email_connections")
        .update({ last_error: fetched.error, status: "error" })
        .eq("id", connection.id);
      return { ok: false, error: fetched.error };
    }

    let synced = 0;
    for (const mail of fetched.messages) {
      const triggerPayload = {
        input: `Email from ${mail.from}\nSubject: ${mail.subject}\n\n${mail.body}`,
        channel: "email",
        startedBy: "imap-sync",
        orgId: session.org!.id,
        emailConnectionId: connection.id,
        email: {
          from: mail.from,
          to: mail.to,
          subject: mail.subject,
          body: mail.body,
          threadId: mail.messageId,
          forwardTo: connection.forward_to,
        },
        from: mail.from,
        subject: mail.subject,
        body: mail.body,
        to: connection.forward_to ?? "",
      };

      const { data: message } = await supabase
        .from("email_messages")
        .insert({
          org_id: session.org!.id,
          connection_id: connection.id,
          direction: "inbound",
          from_address: mail.from,
          to_address: mail.to,
          subject: mail.subject,
          body_text: mail.body,
          thread_id: mail.messageId,
          status: "received",
          meta: { uid: mail.uid, source: "imap" },
        })
        .select("id")
        .single();

      const { executionId } = await startWorkflowRun(supabase, {
        orgId: session.org!.id,
        workflowId: connection.default_workflow_id,
        triggerPayload,
        requestedBy: session.profile.id,
      });

      if (message?.id) {
        await supabase
          .from("email_messages")
          .update({ execution_id: executionId, status: "processed" })
          .eq("id", message.id);
      }
      synced += 1;
    }

    await supabase
      .from("email_connections")
      .update({
        last_synced_at: new Date().toISOString(),
        last_error: null,
        status: "active",
      })
      .eq("id", connection.id);

    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard/executions");
    revalidatePath("/dashboard/approvals");
    return { ok: true, synced };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Sync failed",
    };
  }
}

/** Used by webhook with service role */
export async function processInboundEmailPayload(payload: {
  token: string;
  from: string;
  to?: string;
  subject: string;
  body: string;
  threadId?: string;
}) {
  const admin = createServiceRoleClient();
  const { data: connection } = await admin
    .from("email_connections")
    .select("*")
    .eq("inbound_token", payload.token)
    .eq("status", "active")
    .maybeSingle();

  if (!connection) {
    return { ok: false as const, error: "Unknown inbound token" };
  }
  if (!connection.default_workflow_id) {
    return { ok: false as const, error: "No default workflow linked" };
  }

  const triggerPayload = {
    input: `Email from ${payload.from}\nSubject: ${payload.subject}\n\n${payload.body}`,
    channel: "email",
    startedBy: "email-inbound",
    orgId: connection.org_id,
    emailConnectionId: connection.id,
    email: {
      from: payload.from,
      to: payload.to ?? connection.email_address,
      subject: payload.subject,
      body: payload.body,
      threadId: payload.threadId,
      forwardTo: connection.forward_to,
    },
    from: payload.from,
    subject: payload.subject,
    body: payload.body,
    to: connection.forward_to ?? "",
  };

  const { data: message } = await admin
    .from("email_messages")
    .insert({
      org_id: connection.org_id,
      connection_id: connection.id,
      direction: "inbound",
      from_address: payload.from,
      to_address: payload.to ?? connection.email_address,
      subject: payload.subject,
      body_text: payload.body,
      thread_id: payload.threadId ?? null,
      status: "received",
    })
    .select("id")
    .single();

  const { executionId } = await startWorkflowRun(admin, {
    orgId: connection.org_id,
    workflowId: connection.default_workflow_id,
    triggerPayload,
    requestedBy: null,
  });

  if (message?.id) {
    await admin
      .from("email_messages")
      .update({ execution_id: executionId, status: "processed" })
      .eq("id", message.id);
  }

  return { ok: true as const, executionId };
}
