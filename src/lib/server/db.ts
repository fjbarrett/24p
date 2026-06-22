import "server-only";

import { createHash } from "node:crypto";
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
  // Sliding absolute-expiry for issued bearers (refreshed on each use). NULL on
  // pre-existing rows is treated as "no expiry yet" and backfilled on first use.
  `ALTER TABLE tv_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,
];

let migrationPromise: Promise<void> | null = null;

function migrationId(sql: string) {
  return createHash("sha1").update(sql).digest("hex").slice(0, 16);
}

function summarize(sql: string, max = 120) {
  return sql.replace(/\s+/g, " ").trim().slice(0, max);
}

// Applies each DDL statement at most once, tracked in schema_migrations so the
// list isn't blindly replayed on every boot. Statements stay idempotent
// (IF NOT EXISTS) as a backstop, but failures are now logged loudly instead of
// silently swallowed — a real schema error (permissions, bad SQL) must be
// visible in the logs rather than surfacing later as a mystery 500.
async function runIncrementalMigrations(pool: Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       id         TEXT PRIMARY KEY,
       statement  TEXT NOT NULL,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );

  const appliedRows = await pool.query<{ id: string }>("SELECT id FROM schema_migrations");
  const applied = new Set(appliedRows.rows.map((row) => row.id));

  let failures = 0;
  for (const sql of INCREMENTAL_MIGRATIONS) {
    const id = migrationId(sql);
    if (applied.has(id)) continue;
    try {
      await pool.query(sql);
      await pool.query(
        "INSERT INTO schema_migrations (id, statement) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
        [id, summarize(sql, 500)],
      );
    } catch (err) {
      failures += 1;
      console.error(`[db] MIGRATION FAILED (${id}): ${summarize(sql)}`, err);
    }
  }

  if (failures > 0) {
    console.error(`[db] ${failures} migration statement(s) failed — schema may be out of date`);
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
