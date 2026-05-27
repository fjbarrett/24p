import "server-only";

// Per-key fixed-window in-memory limiter. Per-isolate state; fine for the
// single-container deploy, would need a shared store on multi-replica.
//
// This complements the per-IP limiter in src/proxy.ts: that one is for
// unauthenticated enumeration, this one is for authenticated callers
// hitting expensive endpoints (Anthropic calls, large outbound fan-out).

type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function consume(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    }
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true };
  }
  bucket.count += 1;
  if (bucket.count <= max) return { ok: true };
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.reset - now) / 1000)) };
}
