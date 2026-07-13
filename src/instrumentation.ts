// Next.js runs register() once during server startup, before any request is
// handled. We use it to apply DB schema migrations up front so the first
// request after a deploy can't race the DDL and 500 (the migrations otherwise
// only ran fire-and-forget on the first getPool() call).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getPool, waitForMigrations } = await import("@/lib/server/db");
  getPool();
  // A process with a partially migrated security schema must not receive
  // traffic. Container health gating will retain or restore the prior image.
  await waitForMigrations();
}
