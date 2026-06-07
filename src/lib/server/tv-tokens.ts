import "server-only";

import { createHash, randomBytes, randomInt } from "crypto";
import { getPool } from "@/lib/server/db";

// A short 4-digit PIN is shown to the user; it is a *pairing* code, not the
// credential. The Apple TV exchanges it (once, within the window) for a long
// random bearer token that is what actually stays signed in. Keeping the PIN
// short-lived + single-use + rate-limited at the route is what makes a
// 4-digit (10k-space) code safe against brute force.
const PAIRING_TTL_MS = 10 * 60 * 1000;

export type TvTokenSummary = {
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateBearer(): string {
  return randomBytes(24).toString("hex");
}

function generatePin(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

function normalizePin(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Creates a pairing: a 4-digit PIN tied to a freshly generated bearer token.
 * Returns the PIN to display; the bearer is handed out later via `claimTvPairing`.
 */
export async function createTvPairing(
  userEmail: string,
  label = "Apple TV",
): Promise<{ pin: string; expiresInSeconds: number }> {
  const pool = getPool();
  // Drop stale unclaimed pairings so PINs stay scarce.
  await pool.query(`DELETE FROM tv_tokens WHERE pending_token IS NOT NULL AND pin_expires_at < NOW()`);

  const bearer = generateBearer();
  // Avoid an active-PIN collision (rare, but retry a few times to be safe).
  let pin = generatePin();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clash = await pool.query(
      `SELECT 1 FROM tv_tokens WHERE pin = $1 AND pin_expires_at > NOW() AND pending_token IS NOT NULL LIMIT 1`,
      [pin],
    );
    if (clash.rowCount === 0) break;
    pin = generatePin();
  }

  await pool.query(
    `INSERT INTO tv_tokens (token_hash, user_email, label, pin, pin_expires_at, pending_token)
     VALUES ($1, $2, $3, $4, NOW() + ($5 || ' milliseconds')::interval, $6)`,
    [hashToken(bearer), userEmail, label, pin, String(PAIRING_TTL_MS), bearer],
  );

  return { pin, expiresInSeconds: Math.floor(PAIRING_TTL_MS / 1000) };
}

/**
 * Exchanges a PIN for its bearer token, exactly once and only within the window.
 * Returns the plaintext bearer (never stored in plaintext after this) or null.
 */
export async function claimTvPairing(rawPin: string): Promise<{ token: string } | null> {
  const pin = normalizePin(rawPin);
  if (pin.length !== 4) return null;

  const pool = getPool();
  const result = await pool.query<{ pending_token: string }>(
    `WITH claimed AS (
       SELECT token_hash, pending_token
       FROM tv_tokens
       WHERE pin = $1 AND pin_expires_at > NOW() AND pending_token IS NOT NULL
       ORDER BY pin_expires_at DESC
       LIMIT 1
       FOR UPDATE
     )
     UPDATE tv_tokens t
       SET pending_token = NULL, pin = NULL, pin_expires_at = NULL
       FROM claimed
       WHERE t.token_hash = claimed.token_hash
       RETURNING claimed.pending_token`,
    [pin],
  );

  const token = result.rows[0]?.pending_token;
  return token ? { token } : null;
}

/** Resolves a presented bearer token to its owner's email, or null if unknown. */
export async function resolveTvToken(rawToken: string): Promise<string | null> {
  const token = rawToken.trim();
  if (!token) return null;
  const pool = getPool();
  const result = await pool.query<{ user_email: string }>(
    `UPDATE tv_tokens SET last_used_at = NOW()
     WHERE token_hash = $1 AND pending_token IS NULL
     RETURNING user_email`,
    [hashToken(token)],
  );
  const email = result.rows[0]?.user_email;
  return email ? email.trim().toLowerCase() : null;
}

export async function listTvTokens(userEmail: string): Promise<TvTokenSummary[]> {
  const pool = getPool();
  const result = await pool.query<{ label: string; created_at: string; last_used_at: string | null }>(
    `SELECT label, created_at, last_used_at FROM tv_tokens
     WHERE user_email = $1 AND pending_token IS NULL
     ORDER BY created_at DESC`,
    [userEmail],
  );
  return result.rows.map((row) => ({
    label: row.label,
    createdAt: new Date(row.created_at).toISOString(),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
  }));
}

/** Revokes every Apple TV token and pending pairing for the user. */
export async function revokeTvTokens(userEmail: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query(`DELETE FROM tv_tokens WHERE user_email = $1`, [userEmail]);
  return result.rowCount ?? 0;
}
