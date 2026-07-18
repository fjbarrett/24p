import { describe, expect, test } from "bun:test";

// Integration test: gated on a DISPOSABLE PostgreSQL exactly like the pairing
// suite. Proves /api/health reports DB reachability — the check that would have
// surfaced the recovery-mode outage a `/`-only probe slept through.
const testDbUrl = process.env.TEST_DATABASE_URL;
if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;
  process.env.DB_SSLMODE = "disable";
}

if (process.env.CI && !testDbUrl) {
  throw new Error("TEST_DATABASE_URL is not set in CI — the integration suite would silently skip");
}

describe.skipIf(!testDbUrl)("health endpoint (integration)", () => {
  test("reports ok when the database is reachable", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; db: string; latencyMs: number };
    expect(body.status).toBe("ok");
    expect(body.db).toBe("up");
    expect(typeof body.latencyMs).toBe("number");
  });
});
