import { afterAll, describe, expect, test } from "bun:test";

const testDbUrl = process.env.TEST_DATABASE_URL;
if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;
  process.env.DB_SSLMODE = "disable";
}

const OWNER = "cheapcharts-owner@example.com";

async function reset() {
  const { getPool, waitForMigrations } = await import("@/lib/server/db");
  const pool = getPool();
  await waitForMigrations();
  await pool.query("DELETE FROM cheapcharts_list_links WHERE user_email = $1", [OWNER]);
  await pool.query("DELETE FROM cheapcharts_accounts WHERE user_email = $1", [OWNER]);
  await pool.query("DELETE FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE user_email = $1)", [OWNER]);
  await pool.query("DELETE FROM lists WHERE user_email = $1", [OWNER]);
  return pool;
}

describe.skipIf(!testDbUrl)("CheapCharts list lifecycle (integration)", () => {
  afterAll(async () => {
    if (!testDbUrl) return;
    await reset();
  });

  test("deleting a 24p list also removes its CheapCharts link", async () => {
    const pool = await reset();
    const { createListForUser, deleteListForUser } = await import("@/lib/server/lists");
    const list = await createListForUser("CheapCharts link", OWNER);
    await pool.query(
      `INSERT INTO cheapcharts_accounts (user_email, session_token_ciphertext, country)
       VALUES ($1, 'not-used-by-this-test', 'us')`,
      [OWNER],
    );
    await pool.query(
      `INSERT INTO cheapcharts_list_links
         (list_id, user_email, cheapcharts_list_id, cheapcharts_list_name)
       VALUES ($1, $2, '44', 'Watch next')`,
      [list.id, OWNER],
    );

    await deleteListForUser(list.id, OWNER);

    expect((await pool.query("SELECT 1 FROM cheapcharts_list_links WHERE list_id = $1", [list.id])).rowCount).toBe(0);
    expect((await pool.query("SELECT 1 FROM cheapcharts_accounts WHERE user_email = $1", [OWNER])).rowCount).toBe(1);
  });
});
