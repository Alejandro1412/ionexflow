import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

/**
 * 32-byte key from EMAIL_CREDENTIALS_ENCRYPTION_KEY (hex/base64/utf8)
 * or a derived fallback from SUPABASE_SERVICE_ROLE_KEY (dev only).
 */
function getEncryptionKey(): Buffer {
  const raw =
    process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!raw) {
    throw new Error(
      "EMAIL_CREDENTIALS_ENCRYPTION_KEY (or SUPABASE_SERVICE_ROLE_KEY) is required to store mailbox passwords"
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  try {
    const b64 = Buffer.from(raw, "base64");
    if (b64.length === 32) return b64;
  } catch {
    // fall through
  }

  return createHash("sha256").update(raw).digest();
}

/** AES-256-GCM; ciphertext stored as enc:v1:<iv_b64>:<tag_b64>:<data_b64> */
export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  if (plain.startsWith(PREFIX)) return plain;

  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/** Decrypts enc:v1 payloads; returns legacy plaintext unchanged. */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (!stored.startsWith(PREFIX)) return stored;

  const body = stored.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = body.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Corrupt encrypted mailbox credential");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

export function isEncryptedSecret(stored: string | null | undefined) {
  return Boolean(stored?.startsWith(PREFIX));
}
