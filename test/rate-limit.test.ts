import { describe, expect, test } from "bun:test";
// NOTE: no mock.module here — bun module mocks are process-global and would
// leak into the DB-backed integration tests that run in the same invocation.
// The in-memory `consume` never touches the pool.
import { consume } from "@/lib/server/rate-limit";

describe("consume (in-memory fixed window)", () => {
  test("allows up to max requests, then blocks with a retry hint", () => {
    const key = "test:consume:block";
    expect(consume(key, 2, 60_000)).toEqual({ ok: true });
    expect(consume(key, 2, 60_000)).toEqual({ ok: true });
    const third = consume(key, 2, 60_000);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  test("separate keys use separate buckets", () => {
    expect(consume("test:consume:a", 1, 60_000).ok).toBe(true);
    expect(consume("test:consume:b", 1, 60_000).ok).toBe(true);
  });
});
