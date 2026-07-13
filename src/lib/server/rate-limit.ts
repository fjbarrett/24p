import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";

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

/**
 * PostgreSQL-backed fixed-window limiter for security and upstream-cost
 * boundaries. It survives restarts and remains shared if the app scales out.
 */
export async function consumeDurable(
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const hashedKey = createHash("sha256").update(key).digest("hex");
  const pool = getPool();
  const result = await pool.query<{ count: number; retry_after_seconds: number }>(
    `INSERT INTO api_rate_limits (key, count, reset_at)
     VALUES ($1, 1, NOW() + ($2 || ' milliseconds')::interval)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE
         WHEN api_rate_limits.reset_at <= NOW() THEN 1
         ELSE api_rate_limits.count + 1
       END,
       reset_at = CASE
         WHEN api_rate_limits.reset_at <= NOW()
           THEN NOW() + ($2 || ' milliseconds')::interval
         ELSE api_rate_limits.reset_at
       END
     RETURNING count,
       GREATEST(1, CEIL(EXTRACT(EPOCH FROM (reset_at - NOW()))))::int AS retry_after_seconds`,
    [hashedKey, String(windowMs)],
  );

  if (Math.random() < 0.01) {
    void pool.query("DELETE FROM api_rate_limits WHERE reset_at < NOW() - INTERVAL '1 day'").catch(() => {});
  }

  const bucket = result.rows[0];
  return bucket && bucket.count <= max
    ? { ok: true }
    : { ok: false, retryAfterSeconds: bucket?.retry_after_seconds ?? Math.ceil(windowMs / 1000) };
}

/**
 * Applies durable limits to a public content route and returns the 429 to send,
 * or null to proceed. Limiting here is upstream-cost control, not an auth
 * boundary, so a rate-limit store failure logs and lets the request through
 * instead of taking the endpoint down. Auth flows (pairing, claim, approval)
 * call consumeDurable directly and fail closed.
 */
export async function enforceDurableLimits(
  limits: Array<{ key: string; max: number; windowMs: number }>,
  message = "Too many requests",
): Promise<NextResponse | null> {
  let results: RateLimitResult[];
  try {
    results = await Promise.all(limits.map(({ key, max, windowMs }) => consumeDurable(key, max, windowMs)));
  } catch (error) {
    console.error("[rate-limit] durable limiter unavailable", error);
    return null;
  }
  const blocked = results.find((result): result is { ok: false; retryAfterSeconds: number } => !result.ok);
  if (!blocked) return null;
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(blocked.retryAfterSeconds) } },
  );
}
