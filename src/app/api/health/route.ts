import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";

export const dynamic = "force-dynamic";

// Bound the probe so a hung/black-holed DB still returns promptly (503) instead
// of holding the request open until the socket or pool times out.
const DB_PING_TIMEOUT_MS = 3000;

// Readiness, not liveness. The process answering at all is liveness; the point
// of this route is whether we can actually reach Postgres. It exists because
// `/` renders without a DB round-trip for anonymous requests, so a DB outage
// sails past any `/`-based container/deploy health check (which is exactly how
// one hid in prod). Point an external uptime monitor here and alert on non-200.
// The body is intentionally minimal — up/down and latency, never the pg error
// (which can carry host/credential detail); the detail goes to the logs.
export async function GET() {
  const startedAt = Date.now();
  let dbOk = false;
  try {
    const pool = getPool();
    await Promise.race([
      pool.query("SELECT 1"),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error("db ping timed out")), DB_PING_TIMEOUT_MS),
      ),
    ]);
    dbOk = true;
  } catch (error) {
    console.error("[api/health] db ping failed", error);
  }

  return NextResponse.json(
    { status: dbOk ? "ok" : "degraded", db: dbOk ? "up" : "down", latencyMs: Date.now() - startedAt },
    { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
