import nodemailer from "nodemailer";
import type { MailboxCredentials } from "@/lib/email/presets";

export type OutboundEmailResult = {
  ok: boolean;
  provider: "smtp" | "resend";
  id?: string;
  error?: string;
};

export async function sendViaSmtp(
  account: MailboxCredentials,
  options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
    from?: string;
  }
): Promise<OutboundEmailResult> {
  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    auth: {
      user: account.username,
      pass: account.password,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: options.from?.trim() || account.emailAddress || account.username,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html:
        options.html ??
        `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(options.text)}</pre>`,
      replyTo: options.replyTo,
    });
    return {
      ok: true,
      provider: "smtp",
      id: String(info.messageId ?? info.response ?? "sent"),
    };
  } catch (error) {
    return {
      ok: false,
      provider: "smtp",
      error: error instanceof Error ? error.message : "SMTP send failed",
    };
  } finally {
    transporter.close();
  }
}

export async function verifySmtp(account: MailboxCredentials) {
  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpSecure,
    auth: {
      user: account.username,
      pass: account.password,
    },
  });
  try {
    await transporter.verify();
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "SMTP verify failed",
    };
  } finally {
    transporter.close();
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
