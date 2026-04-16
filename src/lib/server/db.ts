import "server-only";

import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
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

// Columns added incrementally — safe to run on every startup via IF NOT EXISTS.
const INCREMENTAL_MIGRATIONS = [
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streaming_notifications BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS price_notifications BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE streaming_snapshots ADD COLUMN IF NOT EXISTS imdb_id TEXT`,
];

let migrationsRun = false;

async function runIncrementalMigrations(pool: Pool) {
  if (migrationsRun) return;
  migrationsRun = true;
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
    // Fire-and-forget: apply incremental column additions on first pool creation.
    runIncrementalMigrations(global.__24pPool).catch((err) =>
      console.error("[db] Incremental migration failed", err),
    );
  }
  return global.__24pPool;
}
