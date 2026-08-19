import { createHash, randomBytes } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/email/crypto";

describe("email credential crypto", () => {
  const prev = process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY;

  afterEach(() => {
    if (prev === undefined) delete process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = prev;
  });

  it("round-trips AES-GCM secrets", () => {
    process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = createHash("sha256")
      .update(randomBytes(16))
      .digest("hex");

    const plain = "app-password-xyz";
    const enc = encryptSecret(plain);
    expect(isEncryptedSecret(enc)).toBe(true);
    expect(enc).not.toContain(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it("leaves legacy plaintext readable", () => {
    process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = "test-key-for-unit";
    expect(decryptSecret("legacy-plain")).toBe("legacy-plain");
    expect(isEncryptedSecret("legacy-plain")).toBe(false);
  });
});
