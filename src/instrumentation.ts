// Next.js runs register() once during server startup, before any request is
// handled. We use it to apply DB schema migrations up front so the first
// request after a deploy can't race the DDL and 500 (the migrations otherwise
// only ran fire-and-forget on the first getPool() call).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { getPool, waitForMigrations } = await import("@/lib/server/db");
    getPool(); // kicks off runIncrementalMigrations()
    await waitForMigrations();
  } catch (err) {
    // Never block server startup on migration issues — they're logged loudly
    // inside runIncrementalMigrations; a boot loop would be worse than a
    // degraded schema for a single-container deploy.
    console.error("[instrumentation] migration bootstrap failed", err);
  }
}
