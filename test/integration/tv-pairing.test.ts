import { describe, expect, test } from "bun:test";

// Integration tests: run only when TEST_DATABASE_URL points at a DISPOSABLE
// PostgreSQL (CI service container or a local `docker run postgres`). They
// exercise the real migrations plus the device-authorization flow end-to-end.
// Gated on a dedicated variable — never DATABASE_URL — because bun auto-loads
// .env and a developer's DATABASE_URL may point at a real database.
const testDbUrl = process.env.TEST_DATABASE_URL;
if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;
  process.env.DB_SSLMODE = "disable";
}

describe.skipIf(!testDbUrl)("device pairing flow (integration)", () => {
  test("migrations apply cleanly on startup", async () => {
    const { getPool, waitForMigrations } = await import("@/lib/server/db");
    getPool();
    await waitForMigrations();
  });

  test("device authorization round-trip", async () => {
    const {
      startTvPairing,
      approveTvPairing,
      claimTvPairing,
      resolveTvToken,
      listTvTokens,
      revokeTvTokens,
    } = await import("@/lib/server/tv-tokens");
    const email = "tester@example.com";

    const pairing = await startTvPairing("Apple TV");
    expect(pairing.pin).toMatch(/^\d{6}$/);
    expect(pairing.pairingId).toMatch(/^[a-f0-9]{32}$/);
    expect(pairing.deviceToken).toMatch(/^[a-f0-9]{64}$/);

    // Unapproved pairing polls as pending.
    expect((await claimTvPairing(pairing.pairingId, pairing.deviceToken)).status).toBe("pending");

    // The right pairing id with the wrong device token must not claim.
    expect((await claimTvPairing(pairing.pairingId, "0".repeat(64))).status).toBe("invalid");

    // A wrong six-digit code is rejected; the real one approves.
    const wrongPin = pairing.pin === "000000" ? "000001" : "000000";
    expect(await approveTvPairing(email, wrongPin)).toBe(false);
    expect(await approveTvPairing(email, pairing.pin)).toBe(true);

    const claim = await claimTvPairing(pairing.pairingId, pairing.deviceToken);
    expect(claim.status).toBe("approved");
    if (claim.status !== "approved") throw new Error("unreachable");
    expect(claim.token).toBe(pairing.deviceToken);

    // The claim is single-use.
    expect((await claimTvPairing(pairing.pairingId, pairing.deviceToken)).status).toBe("invalid");

    // The bearer resolves to the approving account and shows up as a device.
    expect(await resolveTvToken(pairing.deviceToken)).toBe(email);
    const devices = await listTvTokens(email);
    expect(devices.length).toBeGreaterThanOrEqual(1);
    expect(devices[0].expiresAt).not.toBeNull();
    expect(devices[0].absoluteExpiresAt).not.toBeNull();

    // Revocation kills the bearer.
    await revokeTvTokens(email);
    expect(await resolveTvToken(pairing.deviceToken)).toBeNull();
  });

  test("malformed claim credentials are rejected without touching the table", async () => {
    const { claimTvPairing } = await import("@/lib/server/tv-tokens");
    expect((await claimTvPairing("not-hex", "also-not-hex")).status).toBe("invalid");
    expect((await claimTvPairing("", "")).status).toBe("invalid");
  });

  test("durable limiter blocks after max and reports a retry hint", async () => {
    const { consumeDurable } = await import("@/lib/server/rate-limit");
    const key = `test:durable:${Date.now()}:${Math.random()}`;
    expect((await consumeDurable(key, 2, 60_000)).ok).toBe(true);
    expect((await consumeDurable(key, 2, 60_000)).ok).toBe(true);
    const third = await consumeDurable(key, 2, 60_000);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});
