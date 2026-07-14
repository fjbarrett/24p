import "server-only";

import { createHash } from "node:crypto";
import { checkServerIdentity as defaultCheckServerIdentity, type PeerCertificate } from "node:tls";
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
  // `||` (not ??): docker-compose passes unset vars through as empty strings.
  const sslMode = (process.env.DB_SSLMODE || sslModeFromUrl || "disable").toLowerCase();

  url.searchParams.delete("sslmode");

  // Default to verifying certificates. Hosted DBs with a custom CA can set
  // DB_CA_CERT (PEM contents) to keep verification on. Operators that truly
  // need to skip verification must opt in via DB_SSLMODE=no-verify / allow /
  // prefer — the legacy behavior silently disabled verification for
  // sslmode=require, giving encryption without authentication.
  const ca = process.env.DB_CA_CERT ?? decodeBase64Certificate(process.env.DB_CA_CERT_BASE64);
  const pinnedFingerprint = normalizeFingerprint(process.env.DB_CERT_FINGERPRINT_SHA256);
  const insecureModes = new Set(["no-verify", "allow", "prefer"]);
  if (process.env.NODE_ENV === "production" && insecureModes.has(sslMode)) {
    throw new Error("Production database TLS verification cannot be disabled");
  }
  const ssl =
    sslMode === "disable"
      ? undefined
      : insecureModes.has(sslMode)
        ? { rejectUnauthorized: false }
        : {
            rejectUnauthorized: true,
            ...(ca ? { ca } : {}),
            checkServerIdentity: (host: string, cert: PeerCertificate) => {
              if (!pinnedFingerprint) return defaultCheckServerIdentity(host, cert);
              const actual = normalizeFingerprint(cert.fingerprint256);
              return actual === pinnedFingerprint
                ? undefined
                : new Error("Database certificate fingerprint does not match the configured pin");
            },
          };

  return {
    connectionString: url.toString(),
    ssl,
  };
}

function decodeBase64Certificate(value: string | undefined) {
  if (!value?.trim()) return undefined;
  try {
    const decoded = Buffer.from(value.trim(), "base64").toString("utf8");
    return decoded.includes("BEGIN CERTIFICATE") ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function normalizeFingerprint(value: string | undefined) {
  return value?.replace(/[^a-f0-9]/gi, "").toUpperCase() || undefined;
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
    PRIMARY KEY (list_id, tmdb_id, media_type)
  )`,
  `CREATE TABLE IF NOT EXISTS list_shares (
    list_id            TEXT    NOT NULL,
    shared_with_email  TEXT    NOT NULL,
    can_edit           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (list_id, shared_with_email)
  )`,
  // Favorites predate this migration list (the table was created by the
  // removed rust-api service); the DDL lives here so fresh databases get it.
  // The primary key doubles as the uniqueness ON CONFLICT in lists.ts relies on.
  `CREATE TABLE IF NOT EXISTS user_favorites (
    user_email TEXT NOT NULL,
    list_id    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_email, list_id)
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
  // Sliding absolute-expiry for issued bearers (refreshed on each use). NULL on
  // pre-existing rows is treated as "no expiry yet" and backfilled on first use.
  `ALTER TABLE tv_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,
  `ALTER TABLE tv_tokens ADD COLUMN IF NOT EXISTS absolute_expires_at TIMESTAMPTZ`,
  // Native device authorization. The device owns the high-entropy token while
  // the browser approves only a short display code; plaintext credentials are
  // never persisted in PostgreSQL.
  `CREATE TABLE IF NOT EXISTS tv_pairings (
    pairing_id  TEXT PRIMARY KEY,
    token_hash  TEXT NOT NULL UNIQUE,
    pin         TEXT NOT NULL UNIQUE,
    label       TEXT NOT NULL DEFAULT 'Apple device',
    user_email  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL,
    approved_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS tv_pairings_expires_at_idx ON tv_pairings (expires_at)`,
  // Shared fixed-window counters for public endpoints. Keys are SHA-256 hashes,
  // so client IPs and account identifiers are not retained in plaintext.
  `CREATE TABLE IF NOT EXISTS api_rate_limits (
    key       TEXT PRIMARY KEY,
    count     INTEGER NOT NULL,
    reset_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS api_rate_limits_reset_at_idx ON api_rate_limits (reset_at)`,
  // Remove the legacy global-PIN flow, including plaintext pending bearers.
  `DO $$
   BEGIN
     IF EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'tv_tokens' AND column_name = 'pending_token'
     ) THEN
       DELETE FROM tv_tokens WHERE pending_token IS NOT NULL;
     END IF;
   END $$`,
  `DROP INDEX IF EXISTS tv_tokens_pin_idx`,
  `ALTER TABLE tv_tokens DROP COLUMN IF EXISTS pin`,
  `ALTER TABLE tv_tokens DROP COLUMN IF EXISTS pin_expires_at`,
  `ALTER TABLE tv_tokens DROP COLUMN IF EXISTS pending_token`,
  // Read-through cache of public IMDb ratings fetched from OMDb, keyed by imdb
  // id. rating is NULL when OMDb has no score (so we don't re-fetch on every
  // view); fetched_at drives the refresh TTL.
  `CREATE TABLE IF NOT EXISTS imdb_rating_cache (
    imdb_id    TEXT PRIMARY KEY,
    rating     REAL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  // There are no FK constraints, and list deletion historically removed only
  // the lists row; purge rows orphaned by those deletes (deleteListForUser now
  // removes dependents transactionally).
  `DELETE FROM list_items WHERE NOT EXISTS (SELECT 1 FROM lists WHERE lists.id = list_items.list_id)`,
  `DELETE FROM list_shares WHERE NOT EXISTS (SELECT 1 FROM lists WHERE lists.id = list_shares.list_id)`,
  `DELETE FROM user_favorites WHERE NOT EXISTS (SELECT 1 FROM lists WHERE lists.id = user_favorites.list_id)`,
  // TMDB movie and TV ids are separate, overlapping namespaces; the old
  // (list_id, tmdb_id) key silently dropped a TV title whenever a movie with
  // the same id was already on the list.
  `ALTER TABLE list_items DROP CONSTRAINT IF EXISTS list_items_pkey`,
  `ALTER TABLE list_items ADD PRIMARY KEY (list_id, tmdb_id, media_type)`,
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

  if (failures > 0) throw new Error(`${failures} migration statement(s) failed`);
}

export function getPool() {
  if (!global.__24pPool) {
    const { connectionString, ssl } = resolveDbConfig();
    // `||` (not ??): docker-compose passes unset vars through as empty strings.
    const poolMax = Number(process.env.DB_MAX_CONNECTIONS || 5);
    global.__24pPool = new Pool({
      connectionString,
      max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 5,
      ssl,
    });
    migrationPromise = runIncrementalMigrations(global.__24pPool);
    // Handled here only to avoid an unhandled-rejection crash before
    // waitForMigrations() awaits (and rethrows from) the original promise.
    migrationPromise.catch(() => {});
  }
  return global.__24pPool;
}

/** Resolves once the startup schema migrations have completed. */
export async function waitForMigrations(): Promise<void> {
  if (migrationPromise) await migrationPromise;
}
