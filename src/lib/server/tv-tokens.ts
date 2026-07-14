import "server-only";

import { createHash, randomBytes, randomInt } from "crypto";
import { getPool } from "@/lib/server/db";

const PAIRING_TTL_MS = 10 * 60 * 1000;
const TOKEN_IDLE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_MAX_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const PAIRING_PIN_LENGTH = 6;

export type TvTokenSummary = {
  // Public, non-secret handle for a device (a prefix of the SHA-256 token hash,
  // which is one-way) — used to revoke a single device without the bearer.
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  absoluteExpiresAt: string | null;
};

// Length of the public device id derived from token_hash (64-bit prefix).
const TOKEN_ID_LEN = 16;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateBearer(): string {
  return randomBytes(32).toString("hex");
}

function generatePin(): string {
  return String(randomInt(0, 10 ** PAIRING_PIN_LENGTH)).padStart(PAIRING_PIN_LENGTH, "0");
}

function normalizePin(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Starts device authorization. The device keeps its bearer and pairing id;
 * only the six-digit approval code is shown to the signed-in browser. */
export async function startTvPairing(
  label = "Apple device",
): Promise<{ pairingId: string; deviceToken: string; pin: string; expiresInSeconds: number }> {
  const pool = getPool();
  await pool.query("DELETE FROM tv_pairings WHERE expires_at < NOW()");

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const pairingId = randomBytes(16).toString("hex");
    const deviceToken = generateBearer();
    const pin = generatePin();
    try {
      await pool.query(
        `INSERT INTO tv_pairings (pairing_id, token_hash, pin, label, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + $5 * interval '1 millisecond')`,
        [pairingId, hashToken(deviceToken), pin, label.slice(0, 80), String(PAIRING_TTL_MS)],
      );
      return {
        pairingId,
        deviceToken,
        pin,
        expiresInSeconds: Math.floor(PAIRING_TTL_MS / 1000),
      };
    } catch (error) {
      if ((error as { code?: string }).code !== "23505") throw error;
    }
  }
  throw new Error("Unable to allocate a unique device approval code");
}

/** Approves a device from an authenticated browser session. */
export async function approveTvPairing(userEmail: string, rawPin: string): Promise<boolean> {
  const pin = normalizePin(rawPin);
  if (pin.length !== PAIRING_PIN_LENGTH) return false;

  const pool = getPool();
  const result = await pool.query(
    `WITH approved AS (
       UPDATE tv_pairings
       SET user_email = $1, approved_at = NOW()
       WHERE pairing_id = (
         SELECT pairing_id FROM tv_pairings
         WHERE pin = $2 AND expires_at > NOW() AND approved_at IS NULL
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING token_hash, label
     )
     INSERT INTO tv_tokens (
       token_hash, user_email, label, last_used_at, expires_at, absolute_expires_at
     )
     SELECT token_hash, $1, label, NOW(),
            NOW() + $3 * interval '1 millisecond',
            NOW() + $4 * interval '1 millisecond'
     FROM approved
     ON CONFLICT (token_hash) DO NOTHING
     RETURNING token_hash`,
    [userEmail, pin, String(TOKEN_IDLE_TTL_MS), String(TOKEN_MAX_TTL_MS)],
  );
  return (result.rowCount ?? 0) > 0;
}

export type TvPairingClaim =
  | { status: "pending" }
  | { status: "approved"; token: string }
  | { status: "invalid" };

/** Polls approval using both high-entropy values held only by the device. */
export async function claimTvPairing(pairingIdRaw: string, deviceTokenRaw: string): Promise<TvPairingClaim> {
  const pairingId = pairingIdRaw.trim().toLowerCase();
  const deviceToken = deviceTokenRaw.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(pairingId) || !/^[a-f0-9]{64}$/.test(deviceToken)) {
    return { status: "invalid" };
  }

  const pool = getPool();
  const tokenHash = hashToken(deviceToken);
  const claimed = await pool.query(
    `DELETE FROM tv_pairings
     WHERE pairing_id = $1 AND token_hash = $2 AND expires_at > NOW()
       AND approved_at IS NOT NULL AND user_email IS NOT NULL
     RETURNING pairing_id`,
    [pairingId, tokenHash],
  );
  if ((claimed.rowCount ?? 0) > 0) return { status: "approved", token: deviceToken };

  const pending = await pool.query(
    `SELECT 1 FROM tv_pairings
     WHERE pairing_id = $1 AND token_hash = $2 AND expires_at > NOW() AND approved_at IS NULL`,
    [pairingId, tokenHash],
  );
  return (pending.rowCount ?? 0) > 0 ? { status: "pending" } : { status: "invalid" };
}

/** Resolves a presented bearer token to its owner's email, or null if unknown. */
export async function resolveTvToken(rawToken: string): Promise<string | null> {
  const token = rawToken.trim();
  if (!token) return null;
  const pool = getPool();
  // Reject expired tokens. Successful use refreshes the idle window without
  // extending the credential past its absolute lifetime.
  const result = await pool.query<{ user_email: string }>(
    `UPDATE tv_tokens
       SET last_used_at = NOW(),
           absolute_expires_at = COALESCE(
             absolute_expires_at,
             created_at + $3 * interval '1 millisecond'
           ),
           expires_at = LEAST(
             NOW() + $2 * interval '1 millisecond',
             COALESCE(absolute_expires_at, created_at + $3 * interval '1 millisecond')
           )
     WHERE token_hash = $1
       AND (expires_at IS NULL OR expires_at > NOW())
       AND COALESCE(absolute_expires_at, created_at + $3 * interval '1 millisecond') > NOW()
     RETURNING user_email`,
    [hashToken(token), String(TOKEN_IDLE_TTL_MS), String(TOKEN_MAX_TTL_MS)],
  );
  const email = result.rows[0]?.user_email;
  return email ? email.trim().toLowerCase() : null;
}

export async function listTvTokens(userEmail: string): Promise<TvTokenSummary[]> {
  const pool = getPool();
  const result = await pool.query<{
    token_hash: string;
    label: string;
    created_at: string;
    last_used_at: string | null;
    expires_at: string | null;
    absolute_expires_at: string | null;
  }>(
    `SELECT token_hash, label, created_at, last_used_at, expires_at, absolute_expires_at FROM tv_tokens
     WHERE user_email = $1
     ORDER BY created_at DESC`,
    [userEmail],
  );
  return result.rows.map((row) => ({
    id: row.token_hash.slice(0, TOKEN_ID_LEN),
    label: row.label,
    createdAt: new Date(row.created_at).toISOString(),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    absoluteExpiresAt: row.absolute_expires_at ? new Date(row.absolute_expires_at).toISOString() : null,
  }));
}

/** Revokes a single device by its public id (token_hash prefix). */
export async function revokeTvTokenById(userEmail: string, id: string): Promise<number> {
  // The id is a hex prefix of the SHA-256 token hash — never the bearer itself.
  if (!new RegExp(`^[a-f0-9]{${TOKEN_ID_LEN}}$`).test(id)) return 0;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ token_hash: string }>(
      `DELETE FROM tv_tokens WHERE user_email = $1 AND LEFT(token_hash, ${TOKEN_ID_LEN}) = $2
       RETURNING token_hash`,
      [userEmail, id],
    );
    const hashes = result.rows.map((row) => row.token_hash);
    if (hashes.length) await client.query("DELETE FROM tv_pairings WHERE token_hash = ANY($1::text[])", [hashes]);
    await client.query("COMMIT");
    return result.rowCount ?? 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Revokes every Apple TV token and pending pairing for the user. */
export async function revokeTvTokens(userEmail: string): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM tv_pairings WHERE user_email = $1", [userEmail]);
    const result = await client.query("DELETE FROM tv_tokens WHERE user_email = $1", [userEmail]);
    await client.query("COMMIT");
    return result.rowCount ?? 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
