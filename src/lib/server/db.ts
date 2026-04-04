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

export function getPool() {
  if (!global.__24pPool) {
    const { connectionString, ssl } = resolveDbConfig();
    global.__24pPool = new Pool({
      connectionString,
      max: Number(process.env.DB_MAX_CONNECTIONS ?? 5),
      ssl,
    });
  }
  return global.__24pPool;
}
