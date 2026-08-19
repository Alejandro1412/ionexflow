import { ImapFlow } from "imapflow";
import type { MailboxCredentials } from "@/lib/email/presets";

export type FetchedMail = {
  uid: string;
  messageId: string | null;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string | null;
};

export async function verifyImap(account: MailboxCredentials) {
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    auth: {
      user: account.username,
      pass: account.password,
    },
    logger: false,
  });

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "IMAP verify failed",
    };
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Fetches unseen INBOX messages (capped) and marks them Seen.
 */
export async function fetchUnseenMail(
  account: MailboxCredentials,
  limit = 10
): Promise<{ ok: true; messages: FetchedMail[] } | { ok: false; error: string }> {
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    auth: {
      user: account.username,
      pass: account.password,
    },
    logger: false,
  });

  const messages: FetchedMail[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const searchResult = await client.search({ seen: false }, { uid: true });
      const uids = Array.isArray(searchResult) ? searchResult : [];
      const selected = uids.slice(-limit);

      for (const uid of selected) {
        const fetched = await client.fetchOne(
          uid,
          { source: true, envelope: true, uid: true },
          { uid: true }
        );
        if (!fetched || typeof fetched === "boolean" || !fetched.source) {
          continue;
        }
        const msg = fetched;

        const raw = Buffer.isBuffer(msg.source)
          ? msg.source.toString("utf8")
          : String(msg.source);
        const parsed = parseSimpleRfc822(raw);

        const from =
          parsed.from ||
          msg.envelope?.from?.[0]?.address ||
          "unknown@unknown";
        const to =
          parsed.to ||
          msg.envelope?.to?.[0]?.address ||
          account.emailAddress;
        const subject =
          parsed.subject || msg.envelope?.subject || "(no subject)";

        messages.push({
          uid: String(uid),
          messageId: parsed.messageId || msg.envelope?.messageId || null,
          from,
          to,
          subject,
          body: parsed.body,
          date: parsed.date || msg.envelope?.date?.toISOString() || null,
        });

        await client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }

    return { ok: true, messages };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "IMAP fetch failed",
    };
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}

function parseSimpleRfc822(raw: string) {
  const headerEnd = raw.search(/\r?\n\r?\n/);
  const headerBlock = headerEnd >= 0 ? raw.slice(0, headerEnd) : raw;
  const bodyRaw =
    headerEnd >= 0 ? raw.slice(headerEnd).replace(/^\r?\n\r?\n/, "") : "";

  const get = (name: string) => {
    const re = new RegExp(`^${name}:\\s*(.+)$`, "im");
    const match = headerBlock.match(re);
    return match?.[1]?.trim() ?? "";
  };

  let body = bodyRaw;
  const textPart = bodyRaw.match(
    /Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--)/i
  );
  if (textPart?.[1]) {
    body = textPart[1].trim();
  }

  body = decodeQuotedPrintable(body).slice(0, 20_000);

  return {
    from: extractAddress(get("From")),
    to: extractAddress(get("To")),
    subject: decodeMimeWords(get("Subject") || "(no subject)"),
    messageId: get("Message-ID") || null,
    date: get("Date") || null,
    body: body.trim() || "(empty body)",
  };
}

function extractAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim();
}

function decodeMimeWords(value: string) {
  return value.replace(
    /=\?([^?]+)\?([bq])\?([^?]+)\?=/gi,
    (_, _cs, enc, text) => {
      try {
        if (String(enc).toLowerCase() === "b") {
          return Buffer.from(text, "base64").toString("utf8");
        }
        return decodeQuotedPrintable(String(text).replace(/_/g, " "));
      } catch {
        return value;
      }
    }
  );
}

function decodeQuotedPrintable(value: string) {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}
