import "server-only";

import { Pool } from "pg";

declare global {
  var __24pPool: Pool | undefined;
}

function resolveDbConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not configured");
  }

  const url = new URL(raw);
  const sslModeFromUrl = url.searchParams.get("sslmode")?.toLowerCase();
  const sslMode = (process.env.DB_SSLMODE ?? sslModeFromUrl ?? "disable").toLowerCase();

  url.searchParams.delete("sslmode");

  // Default to verifying certificates. Hosted DBs with a custom CA can set
  // DB_CA_CERT (PEM contents) to keep verification on. Operators that truly
  // need to skip verification must opt in via DB_SSLMODE=no-verify / allow /
  // prefer — the legacy behavior silently disabled verification for
  // sslmode=require, giving encryption without authentication.
  const ca = process.env.DB_CA_CERT;
  const insecureModes = new Set(["no-verify", "allow", "prefer"]);
  const ssl =
    sslMode === "disable"
      ? undefined
      : insecureModes.has(sslMode)
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: true, ...(ca ? { ca } : {}) };

  return {
    connectionString: url.toString(),
    ssl,
  };
}

// DDL that is safe to run on every startup via IF NOT EXISTS.
// Core tables come first so the ALTER TABLE statements that follow always have a target.
const INCREMENTAL_MIGRATIONS = [
  // ── Core schema ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS profiles (
    user_email TEXT PRIMARY KEY,
    username   TEXT UNIQUE,
    is_public  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS lists (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    slug       TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private',
    color      TEXT,
    user_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_email, slug)
  )`,
  `CREATE TABLE IF NOT EXISTS list_items (
    list_id    TEXT    NOT NULL,
    tmdb_id    INTEGER NOT NULL,
    media_type TEXT    NOT NULL DEFAULT 'movie',
    position   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (list_id, tmdb_id)
  )`,
  `CREATE TABLE IF NOT EXISTS list_shares (
    list_id            TEXT    NOT NULL,
    shared_with_email  TEXT    NOT NULL,
    can_edit           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (list_id, shared_with_email)
  )`,
  `CREATE TABLE IF NOT EXISTS user_ratings (
    user_email TEXT    NOT NULL,
    tmdb_id    INTEGER NOT NULL,
    rating     INTEGER NOT NULL,
    source     TEXT    NOT NULL DEFAULT 'tmdb',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_email, tmdb_id)
  )`,
  // Long-lived bearer tokens for native clients (e.g. Apple TV). Only the
  // SHA-256 hash is stored; the plaintext is shown to the user once at mint.
  `CREATE TABLE IF NOT EXISTS tv_tokens (
    token_hash   TEXT PRIMARY KEY,
    user_email   TEXT NOT NULL,
    label        TEXT NOT NULL DEFAULT 'Apple TV',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS tv_tokens_user_email_idx ON tv_tokens (user_email)`,
  // Pairing columns: a short-lived 4-digit PIN is exchanged for the bearer
  // (held in pending_token until claimed, then nulled).
  `ALTER TABLE tv_tokens ADD COLUMN IF NOT EXISTS pin TEXT`,
  `ALTER TABLE tv_tokens ADD COLUMN IF NOT EXISTS pin_expires_at TIMESTAMPTZ`,
  `ALTER TABLE tv_tokens ADD COLUMN IF NOT EXISTS pending_token TEXT`,
  `CREATE INDEX IF NOT EXISTS tv_tokens_pin_idx ON tv_tokens (pin)`,
];

let migrationPromise: Promise<void> | null = null;

async function runIncrementalMigrations(pool: Pool): Promise<void> {
  for (const sql of INCREMENTAL_MIGRATIONS) {
    try {
      await pool.query(sql);
    } catch {
      // Table may not exist yet in fresh environments — ignore and move on.
    }
  }
}

export function getPool() {
  if (!global.__24pPool) {
    const { connectionString, ssl } = resolveDbConfig();
    global.__24pPool = new Pool({
      connectionString,
      max: Number(process.env.DB_MAX_CONNECTIONS ?? 5),
      ssl,
    });
    migrationPromise = runIncrementalMigrations(global.__24pPool).catch((err) =>
      console.error("[db] Incremental migration failed", err),
    );
  }
  return global.__24pPool;
}

/** Resolves once the startup schema migrations have completed. */
export async function waitForMigrations(): Promise<void> {
  if (migrationPromise) await migrationPromise;
}
