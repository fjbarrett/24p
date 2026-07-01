import "server-only";

import { getPool } from "@/lib/server/db";

// IMDb scores come from OMDb (omdbapi.com), keyed by imdb id, and are cached in
// Postgres so a title is fetched at most once per TTL — across deploys and
// regardless of how many pages render it. The free OMDb tier is 1000/day, which
// the cache keeps us well under. This replaced a JustWatch scrape whose catalog
// endpoint rate-limited the prod IP (429) and silently dropped ratings.

const OMDB_ENDPOINT = "https://www.omdbapi.com/";
const FETCH_TIMEOUT_MS = 5000;
// Ratings drift slowly; refresh weekly. On an OMDb error we serve any cached
// value regardless of age — a stale score beats a missing badge.
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const IMDB_ID_RE = /^tt\d{7,10}$/;

// pg returns REAL as a number and timestamptz as a Date; allow strings too in
// case a custom type parser is ever configured.
type CacheRow = { rating: number | string | null; fetched_at: Date | string };

function getOmdbKey() {
  return process.env.OMDB_API_KEY?.trim() || null;
}

async function readCache(imdbId: string): Promise<{ rating: number | null; fetchedAt: number } | null> {
  const pool = getPool();
  const result = await pool.query<CacheRow>(
    "SELECT rating, fetched_at FROM imdb_rating_cache WHERE imdb_id = $1",
    [imdbId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    rating: row.rating === null ? null : Number(row.rating),
    fetchedAt: new Date(row.fetched_at).getTime(),
  };
}

async function writeCache(imdbId: string, rating: number | null): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO imdb_rating_cache (imdb_id, rating, fetched_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (imdb_id) DO UPDATE SET rating = EXCLUDED.rating, fetched_at = NOW()`,
    [imdbId, rating],
  );
}

// number = OMDb rating, null = OMDb answered but has no rating (N/A), undefined
// = the request failed and the caller should fall back to a cached value.
async function fetchOmdbRating(imdbId: string): Promise<number | null | undefined> {
  const key = getOmdbKey();
  if (!key) return undefined;
  try {
    const url = new URL(OMDB_ENDPOINT);
    url.searchParams.set("apikey", key);
    url.searchParams.set("i", imdbId);
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store", // the DB is our cache; don't double-cache in Next
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { Response?: string; imdbRating?: string };
    if (data.Response === "False") return null;
    const raw = data.imdbRating;
    if (!raw || raw === "N/A") return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(1)) : null;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the public IMDb rating for a title by its imdb id, read-through the
 * Postgres cache. Returns undefined when there's no id, no OMDb key configured,
 * or no rating available. Never throws — a rating is decorative, so any DB or
 * network failure degrades to "no badge" rather than breaking the page.
 */
export async function getImdbRating(imdbId?: string | null): Promise<number | undefined> {
  if (!imdbId || !IMDB_ID_RE.test(imdbId)) return undefined;
  if (!getOmdbKey()) return undefined;

  let cached: Awaited<ReturnType<typeof readCache>> = null;
  try {
    cached = await readCache(imdbId);
  } catch {
    cached = null; // a DB hiccup shouldn't block the OMDb path
  }

  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.rating ?? undefined;
  }

  const fetched = await fetchOmdbRating(imdbId);
  if (fetched !== undefined) {
    try {
      await writeCache(imdbId, fetched);
    } catch {
      // best-effort write; still return what we fetched
    }
    return fetched ?? undefined;
  }

  // OMDb failed — serve a stale value if we have one.
  return cached?.rating ?? undefined;
}
