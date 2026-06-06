import "server-only";

import { createHash, randomInt } from "crypto";
import { getPool } from "@/lib/server/db";

// Unambiguous alphabet (no 0/O/1/I/L) so the code is easy to read off a TV and
// type on a remote. 12 chars grouped as XXXX-XXXX-XXXX ≈ 59 bits of entropy.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TOKEN_LENGTH = 12;

export type TvTokenSummary = {
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
};

function normalize(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashToken(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

function generateToken(): { display: string; normalized: string } {
  let raw = "";
  for (let i = 0; i < TOKEN_LENGTH; i += 1) {
    raw += ALPHABET[randomInt(ALPHABET.length)];
  }
  const display = raw.replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3");
  return { display, normalized: raw };
}

/** Mints a new Apple TV token for the user and returns the plaintext once. */
export async function mintTvToken(userEmail: string, label = "Apple TV"): Promise<{ token: string }> {
  const pool = getPool();
  const { display, normalized } = generateToken();
  await pool.query(`INSERT INTO tv_tokens (token_hash, user_email, label) VALUES ($1, $2, $3)`, [
    hashToken(normalized),
    userEmail,
    label,
  ]);
  return { token: display };
}

/** Resolves a presented token to its owner's email, or null if unknown. */
export async function resolveTvToken(rawToken: string): Promise<string | null> {
  const normalized = normalize(rawToken);
  if (normalized.length !== TOKEN_LENGTH) return null;
  const pool = getPool();
  const result = await pool.query<{ user_email: string }>(
    `UPDATE tv_tokens SET last_used_at = NOW() WHERE token_hash = $1 RETURNING user_email`,
    [hashToken(normalized)],
  );
  const email = result.rows[0]?.user_email;
  return email ? email.trim().toLowerCase() : null;
}

export async function listTvTokens(userEmail: string): Promise<TvTokenSummary[]> {
  const pool = getPool();
  const result = await pool.query<{ label: string; created_at: string; last_used_at: string | null }>(
    `SELECT label, created_at, last_used_at FROM tv_tokens WHERE user_email = $1 ORDER BY created_at DESC`,
    [userEmail],
  );
  return result.rows.map((row) => ({
    label: row.label,
    createdAt: new Date(row.created_at).toISOString(),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
  }));
}

/** Revokes every Apple TV token for the user (used by the "sign out everywhere" action). */
export async function revokeTvTokens(userEmail: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query(`DELETE FROM tv_tokens WHERE user_email = $1`, [userEmail]);
  return result.rowCount ?? 0;
}
