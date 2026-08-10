import { afterAll, describe, expect, test } from "bun:test";

// Integration tests: run only when TEST_DATABASE_URL points at a DISPOSABLE
// PostgreSQL (CI service container or a local throwaway cluster). Gated on a
// dedicated variable — never DATABASE_URL — because bun auto-loads .env and a
// developer's DATABASE_URL may point at a real database.
const testDbUrl = process.env.TEST_DATABASE_URL;
if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;
  process.env.DB_SSLMODE = "disable";
}

if (process.env.CI && !testDbUrl) {
  throw new Error("TEST_DATABASE_URL is not set in CI — the integration suite would silently skip");
}

const OWNER = "owner-visibility@example.com";
const VIEWER = "viewer-visibility@example.com";

async function reset() {
  const { getPool, waitForMigrations } = await import("@/lib/server/db");
  const pool = getPool();
  await waitForMigrations();
  await pool.query("DELETE FROM user_favorites WHERE user_email = ANY($1::text[])", [[OWNER, VIEWER]]);
  await pool.query("DELETE FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE user_email = $1)", [OWNER]);
  await pool.query("DELETE FROM lists WHERE user_email = ANY($1::text[])", [[OWNER, VIEWER]]);
  await pool.query("DELETE FROM profiles WHERE user_email = ANY($1::text[])", [[OWNER, VIEWER]]);
  return pool;
}

async function setProfilePublic(isPublic: boolean) {
  const { getPool } = await import("@/lib/server/db");
  await getPool().query("UPDATE profiles SET is_public = $2 WHERE user_email = $1", [OWNER, isPublic]);
}

describe.skipIf(!testDbUrl)("a private profile's public lists (integration)", () => {
  afterAll(async () => {
    if (!testDbUrl) return;
    await reset();
  });

  test("stay out of favorites once the owner goes private", async () => {
    const pool = await reset();
    const { createListForUser, updateListForUser, addFavoriteForUser, loadFavoritesForUser } = await import(
      "@/lib/server/lists"
    );
    const { setUsernameForUser } = await import("@/lib/server/profiles");

    await setUsernameForUser(OWNER, "ownervis");
    await setProfilePublic(true);
    const list = await createListForUser("Noir picks", OWNER, [603]);
    await updateListForUser(list.id, OWNER, { visibility: "public" });

    // Public profile, public list: the viewer can favourite it and read it back.
    await addFavoriteForUser(list.id, VIEWER);
    expect((await loadFavoritesForUser(VIEWER)).map((entry) => entry.id)).toContain(list.id);

    // The owner goes private. The favourite row survives, but the list must not
    // come back through it — that was the side door this closes.
    await setProfilePublic(false);
    expect((await loadFavoritesForUser(VIEWER)).map((entry) => entry.id)).not.toContain(list.id);

    // And it can no longer be favourited from scratch either.
    await pool.query("DELETE FROM user_favorites WHERE user_email = $1", [VIEWER]);
    await expect(addFavoriteForUser(list.id, VIEWER)).rejects.toThrow("List not found");

    // The owner still sees their own list, private profile or not.
    await addFavoriteForUser(list.id, OWNER);
    expect((await loadFavoritesForUser(OWNER)).map((entry) => entry.id)).toContain(list.id);
  });
});
