import { createServiceRoleClient } from "@/lib/supabase/server";
import type { MailboxCredentials } from "@/lib/email/presets";
import { sendViaSmtp } from "@/lib/email/smtp";
import type { OutboundEmailResult } from "@/lib/email/smtp";
import { decryptSecret } from "@/lib/email/crypto";

export function rowToCredentials(row: {
  email_address: string | null;
  username: string | null;
  password: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_secure: boolean | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean | null;
}): MailboxCredentials | null {
  if (
    !row.username ||
    !row.password ||
    !row.imap_host ||
    !row.smtp_host ||
    !row.email_address
  ) {
    return null;
  }

  let password: string;
  try {
    password = decryptSecret(row.password) ?? "";
  } catch {
    return null;
  }
  if (!password) return null;

  return {
    emailAddress: row.email_address,
    username: row.username,
    password,
    imapHost: row.imap_host,
    imapPort: row.imap_port ?? 993,
    imapSecure: row.imap_secure ?? true,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port ?? 465,
    smtpSecure: row.smtp_secure ?? true,
  };
}

export async function loadActiveMailbox(options: {
  orgId: string;
  connectionId?: string | null;
}) {
  const admin = createServiceRoleClient();
  let query = admin
    .from("email_connections")
    .select("*")
    .eq("org_id", options.orgId)
    .eq("status", "active");

  if (options.connectionId) {
    query = query.eq("id", options.connectionId);
  }

  const { data } = await query
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const creds = rowToCredentials(data);
  if (!creds) return null;
  return { row: data, credentials: creds };
}

/**
 * Real send: uses the org's connected SMTP mailbox.
 * Optional Resend fallback only if explicitly enabled via IONEX_EMAIL_FALLBACK_RESEND=true.
 */
export async function sendOutboundEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  from?: string;
  orgId?: string | null;
  connectionId?: string | null;
}): Promise<OutboundEmailResult & { demo?: boolean }> {
  if (options.orgId) {
    const mailbox = await loadActiveMailbox({
      orgId: options.orgId,
      connectionId: options.connectionId,
    });
    if (mailbox) {
      return sendViaSmtp(mailbox.credentials, {
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
        from: options.from || mailbox.credentials.emailAddress,
      });
    }
  }

  if (process.env.IONEX_EMAIL_FALLBACK_RESEND === "true") {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from =
      options.from?.trim() ||
      process.env.RESEND_FROM?.trim() ||
      "IonexFlow <onboarding@resend.dev>";
    if (apiKey) {
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
            text: options.text,
            html: options.html,
            reply_to: options.replyTo,
          }),
        });
        if (!res.ok) {
          const detail = await res.text();
          return {
            ok: false,
            provider: "resend",
            error: `Resend ${res.status}: ${detail.slice(0, 300)}`,
          };
        }
        const json = (await res.json()) as { id?: string };
        return { ok: true, provider: "resend", id: json.id };
      } catch (error) {
        return {
          ok: false,
          provider: "resend",
          error: error instanceof Error ? error.message : "Resend failed",
        };
      }
    }
  }

  return {
    ok: false,
    provider: "smtp",
    error:
      "No active SMTP mailbox connected. Open Integrations and connect IMAP/SMTP credentials.",
  };
}
