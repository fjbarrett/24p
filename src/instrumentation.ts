// Next.js runs register() once during server startup, before any request is
// handled. We use it to apply DB schema migrations up front so the first
// request after a deploy can't race the DDL and 500 (the migrations otherwise
// only ran fire-and-forget on the first getPool() call).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { getPool, waitForMigrations } = await import("@/lib/server/db");
    getPool();
    await waitForMigrations();
  } catch (error) {
    // Distinguish two failure modes that used to be conflated:
    //  - DB unreachable at boot (down / in recovery): booting anyway is the
    //    right trade. A throwing hook takes the WHOLE app down — even routes
    //    that never touch the DB — turning a partial DB outage into a total
    //    one, and the deploy health-gate can't rescue it because every fresh
    //    container hits the same wall. Serve stateless routes; DB routes 500
    //    until the pool reconnects. Migrations are idempotent + tracked, so
    //    they re-apply on the next healthy boot.
    //  - A genuine migration/SQL error (a deploy bug): still fail startup so a
    //    partially migrated schema never receives traffic and the health gate
    //    retains the prior image.
    if (isDatabaseUnavailable(error)) {
      console.error("[instrumentation] database unreachable at startup; booting in degraded mode", error);
      return;
    }
    throw error;
  }
}

// True when the failure is the database being unreachable/unavailable rather
// than a schema or SQL fault — pg SQLSTATE 57P0x (cannot_connect_now / shutdown)
// and class 08 (connection exceptions), or a Node socket-level error.
function isDatabaseUnavailable(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (typeof code === "string") {
    if (code === "57P03" || code === "57P01" || code === "57P02" || code.startsWith("08")) return true;
    if (["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "EPIPE"].includes(code)) return true;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return /recovery mode|not yet accepting connections|connection terminated|connect(ion)? timeout|econn|socket/.test(
    message,
  );
}
