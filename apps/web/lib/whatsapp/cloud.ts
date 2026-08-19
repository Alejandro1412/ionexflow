import { decryptSecret, encryptSecret } from "@/lib/email/crypto";

export type WhatsAppCredentials = {
  phoneNumberId: string;
  accessToken: string;
};

export function rowToWhatsAppCredentials(row: {
  phone_number_id: string | null;
  access_token: string | null;
}): WhatsAppCredentials | null {
  if (!row.phone_number_id || !row.access_token) return null;
  let token: string;
  try {
    token = decryptSecret(row.access_token) ?? "";
  } catch {
    return null;
  }
  if (!token) return null;
  return { phoneNumberId: row.phone_number_id, accessToken: token };
}

export function encryptWhatsAppToken(token: string) {
  return encryptSecret(token);
}

export async function sendWhatsAppText(options: {
  credentials: WhatsAppCredentials;
  to: string;
  text: string;
}): Promise<{ ok: boolean; id?: string; error?: string; provider: string }> {
  const to = options.to.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!to || !options.text.trim()) {
    return { ok: false, error: "Missing to/text", provider: "whatsapp" };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${options.credentials.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.credentials.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: options.text.slice(0, 4096), preview_url: false },
        }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        error: json.error?.message ?? `WhatsApp API ${res.status}`,
        provider: "whatsapp",
      };
    }
    return {
      ok: true,
      id: json.messages?.[0]?.id,
      provider: "whatsapp",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "WhatsApp send failed",
      provider: "whatsapp",
    };
  }
}
