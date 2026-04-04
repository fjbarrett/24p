import "server-only";

import { getPool } from "@/lib/server/db";

type RatingInput = {
  tmdbId: number;
  rating: number;
  source: string;
};

export async function saveRatingsForUser(userEmail: string, ratings: RatingInput[]) {
  const pool = getPool();
  for (const entry of ratings) {
    if (!Number.isInteger(entry.tmdbId)) {
      throw new Error("tmdbId is required");
    }
    if (!Number.isInteger(entry.rating) || entry.rating < 1 || entry.rating > 10) {
      throw new Error("rating must be between 1 and 10");
    }
    await pool.query(
      `
        INSERT INTO user_ratings (user_email, tmdb_id, rating, source)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_email, tmdb_id)
        DO UPDATE SET rating = EXCLUDED.rating, source = EXCLUDED.source, updated_at = NOW()
      `,
      [userEmail, entry.tmdbId, entry.rating, entry.source || "tmdb"],
    );
  }
  return ratings.length;
}

export async function getRatingsMapForUser(userEmail: string) {
  const pool = getPool();
  const result = await pool.query<{ tmdb_id: number; rating: number }>(
    "SELECT tmdb_id, rating FROM user_ratings WHERE user_email = $1 ORDER BY updated_at DESC",
    [userEmail],
  );
  return result.rows.reduce<Record<number, number>>((map, row) => {
    map[row.tmdb_id] = row.rating;
    return map;
  }, {});
}

export async function getRatingForUser(userEmail: string, tmdbId: number) {
  const pool = getPool();
  const result = await pool.query<{ rating: number }>(
    "SELECT rating FROM user_ratings WHERE user_email = $1 AND tmdb_id = $2",
    [userEmail, tmdbId],
  );
  return result.rows[0]?.rating ?? null;
}
