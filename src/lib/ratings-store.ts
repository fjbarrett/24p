import { promises as fs } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const DATA_PATH = path.join(process.cwd(), "data", "ratings.json");

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;
let ensuredTable = false;

type RatingRow = {
  user_email: string;
  tmdb_id: number;
  rating: number;
  source: string;
  updated_at: string;
};

async function ensureTable() {
  if (!pool || ensuredTable) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_ratings (
      user_email text NOT NULL,
      tmdb_id integer NOT NULL,
      rating integer NOT NULL,
      source text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_email, tmdb_id)
    );
  `);
  ensuredTable = true;
}

async function query<T = RatingRow>(sql: string, params: unknown[] = []) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  await ensureTable();
  const result = await pool.query<T>(sql, params);
  return result.rows;
}

export async function saveRatings(
  userEmail: string,
  ratings: Array<{ tmdbId: number; rating: number; source: string }>,
) {
  if (!ratings.length) return;
  if (!pool) {
    const existing = await loadRatingsFromFile();
    const key = userEmail.toLowerCase();
    const current = existing[key] ?? {};
    ratings.forEach(({ tmdbId, rating, source }) => {
      current[tmdbId] = { rating, source, updatedAt: new Date().toISOString() };
    });
    existing[key] = current;
    await saveRatingsToFile(existing);
    return;
  }
  const sql = `
    INSERT INTO user_ratings (user_email, tmdb_id, rating, source)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_email, tmdb_id)
    DO UPDATE SET rating = EXCLUDED.rating, source = EXCLUDED.source, updated_at = NOW()
  `;
  for (const entry of ratings) {
    await query(sql, [userEmail, entry.tmdbId, entry.rating, entry.source]);
  }
}

export async function getRating(userEmail: string, tmdbId: number) {
  if (!pool) {
    const existing = await loadRatingsFromFile();
    const key = userEmail.toLowerCase();
    return existing[key]?.[tmdbId]?.rating ?? null;
  }
  const rows = await query<RatingRow>(
    "SELECT rating FROM user_ratings WHERE user_email = $1 AND tmdb_id = $2",
    [userEmail, tmdbId],
  );
  return rows.length ? rows[0].rating : null;
}

export async function getRatingsForUser(userEmail: string) {
  if (!pool) {
    const existing = await loadRatingsFromFile();
    const key = userEmail.toLowerCase();
    return existing[key] ? { ...existing[key] } : {};
  }
  const rows = await query<RatingRow>(
    "SELECT tmdb_id, rating FROM user_ratings WHERE user_email = $1",
    [userEmail],
  );
  const map: Record<number, number> = {};
  rows.forEach((row) => {
    map[row.tmdb_id] = row.rating;
  });
  return map;
}

type FileRatings = Record<string, Record<number, { rating: number; source: string; updatedAt: string }>>;

async function loadRatingsFromFile(): Promise<FileRatings> {
  try {
    const contents = await fs.readFile(DATA_PATH, "utf8");
    return JSON.parse(contents) as FileRatings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
      await fs.writeFile(DATA_PATH, "{}\n", "utf8");
      return {};
    }
    throw error;
  }
}

async function saveRatingsToFile(data: FileRatings) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}
