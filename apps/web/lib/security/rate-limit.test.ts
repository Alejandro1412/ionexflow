import { describe, expect, it } from "vitest";
import { allowRateLimit } from "@/lib/security/rate-limit";

describe("allowRateLimit", () => {
  it("allows up to the limit then blocks", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    expect(allowRateLimit(key, { limit: 2, windowMs: 60_000 })).toBe(true);
    expect(allowRateLimit(key, { limit: 2, windowMs: 60_000 })).toBe(true);
    expect(allowRateLimit(key, { limit: 2, windowMs: 60_000 })).toBe(false);
  });
});
