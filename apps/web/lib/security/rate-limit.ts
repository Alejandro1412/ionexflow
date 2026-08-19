type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Simple in-memory sliding window. Good enough for single-instance / soft abuse.
 * Returns true if the request is allowed.
 */
export function allowRateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): boolean {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return true;
  }
  if (existing.count >= options.limit) return false;
  existing.count += 1;
  return true;
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
