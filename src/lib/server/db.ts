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

  // Let node-postgres take an explicit ssl object instead of inferring strict TLS
  // from the connection string. This avoids self-signed CA failures on hosted DBs.
  url.searchParams.delete("sslmode");

  const ssl =
    sslMode === "disable"
      ? undefined
      : sslMode === "verify-full"
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false };

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
  // ── Feature additions ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS streaming_snapshots (
    tmdb_id              INTEGER     NOT NULL,
    media_type           TEXT        NOT NULL DEFAULT 'movie',
    title                TEXT        NOT NULL DEFAULT '',
    release_year         INTEGER,
    poster_url           TEXT,
    imdb_id              TEXT,
    provider_short_names TEXT[]      NOT NULL DEFAULT '{}',
    last_checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tmdb_id, media_type)
  )`,
  `CREATE TABLE IF NOT EXISTS price_snapshots (
    imdb_id         TEXT    NOT NULL,
    tmdb_id         INTEGER,
    title           TEXT    NOT NULL DEFAULT '',
    poster_url      TEXT,
    buy_price_usd   NUMERIC,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (imdb_id)
  )`,
  `ALTER TABLE streaming_snapshots ADD COLUMN IF NOT EXISTS imdb_id TEXT`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streaming_notifications BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS price_notifications BOOLEAN NOT NULL DEFAULT FALSE`,
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
