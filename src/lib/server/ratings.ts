import "server-only";

import { getPool } from "@/lib/server/db";
import { publicError } from "@/lib/server/http";

type RatingInput = {
  tmdbId: number;
  rating: number;
  source: string;
};

type UserRatingRow = {
  tmdb_id: number;
  rating: number;
  source: string;
  updated_at: string;
};

export async function saveRatingsForUser(userEmail: string, ratings: RatingInput[]) {
  // Validate the whole batch before writing anything: a 400 must mean
  // "nothing was saved", not "some rows committed before the bad one".
  for (const entry of ratings) {
    if (!Number.isInteger(entry.tmdbId)) {
      publicError("tmdbId is required", 400);
    }
    if (!Number.isInteger(entry.rating) || entry.rating < 1 || entry.rating > 10) {
      publicError("rating must be between 1 and 10", 400);
    }
  }
  if (!ratings.length) return 0;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const entry of ratings) {
      await client.query(
        `
          INSERT INTO user_ratings (user_email, tmdb_id, rating, source)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_email, tmdb_id)
          DO UPDATE SET rating = EXCLUDED.rating, source = EXCLUDED.source, updated_at = NOW()
        `,
        [userEmail, entry.tmdbId, entry.rating, entry.source || "tmdb"],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return ratings.length;
}

export async function getRatingsMapForUser(userEmail: string) {
  const pool = getPool();
  const result = await pool.query<UserRatingRow>(
    "SELECT tmdb_id, rating, source, updated_at FROM user_ratings WHERE user_email = $1 ORDER BY updated_at DESC",
    [userEmail],
  );
  return result.rows.reduce<Record<number, number>>((map, row) => {
    map[row.tmdb_id] = row.rating;
    return map;
  }, {});
}

export async function getRatingsForUser(userEmail: string) {
  const pool = getPool();
  const result = await pool.query<UserRatingRow>(
    "SELECT tmdb_id, rating, source, updated_at FROM user_ratings WHERE user_email = $1 ORDER BY updated_at DESC",
    [userEmail],
  );
  return result.rows.map((row) => ({
    tmdbId: row.tmdb_id,
    rating: row.rating,
    source: row.source,
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

export async function getRatingForUser(userEmail: string, tmdbId: number) {
  const pool = getPool();
  const result = await pool.query<{ rating: number }>(
    "SELECT rating FROM user_ratings WHERE user_email = $1 AND tmdb_id = $2",
    [userEmail, tmdbId],
  );
  return result.rows[0]?.rating ?? null;
}
