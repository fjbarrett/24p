import "server-only";

import { getPool } from "@/lib/server/db";

type CheapChartsPayload = {
  imdbId?: string | null;
  productPageUrl?: string | null;
  itunesUrl?: string | null;
  price?: string | null;
};

type CheapChartsSearchResponse = {
  results?: Record<string, unknown>;
};

type AppleTvLinkResult = {
  url: string | null;
  price: string | null;
};

const DEFAULT_STRAWBERRY_BASE_URL =
  process.env.NODE_ENV === "development" ? "https://strawberry.fjbarrett.workers.dev" : "";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

let cacheTableReady = false;

function getStrawberryBaseUrl() {
  const candidate =
    process.env.STRAWBERRY_BASE_URL ??
    process.env.NEXT_PUBLIC_STRAWBERRY_BASE_URL ??
    DEFAULT_STRAWBERRY_BASE_URL;
  return candidate.replace(/\/$/, "");
}

function normalizePrice(price?: string | null) {
  if (!price) return null;
  const trimmed = price.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
}

function toLinkResult(payload?: CheapChartsPayload | null): AppleTvLinkResult {
  return {
    url: payload?.productPageUrl ?? payload?.itunesUrl ?? null,
    price: normalizePrice(payload?.price),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function flattenObjects(value: unknown): CheapChartsPayload[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenObjects);
  }
  if (!isRecord(value)) {
    return [];
  }

  const nested = Object.values(value).flatMap(flattenObjects);
  return [value as CheapChartsPayload, ...nested];
}

async function ensureAppleCacheTable() {
  if (cacheTableReady) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS external_apple_tv_cache (
      imdb_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT,
      price TEXT,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  cacheTableReady = true;
}

async function readAppleCache(imdbId: string): Promise<AppleTvLinkResult | null> {
  try {
    await ensureAppleCacheTable();
    const pool = getPool();
    const result = await pool.query<{ url: string | null; price: string | null; fetched_at: Date }>(
      `SELECT url, price, fetched_at
       FROM external_apple_tv_cache
       WHERE imdb_id = $1`,
      [imdbId],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (Date.now() - new Date(row.fetched_at).getTime() > CACHE_TTL_MS) return null;
    return { url: row.url, price: row.price };
  } catch {
    return null;
  }
}

async function writeAppleCache(imdbId: string, title: string, result: AppleTvLinkResult) {
  try {
    await ensureAppleCacheTable();
    const pool = getPool();
    await pool.query(
      `INSERT INTO external_apple_tv_cache (imdb_id, title, url, price, fetched_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (imdb_id)
       DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, price = EXCLUDED.price, fetched_at = NOW()`,
      [imdbId, title, result.url, result.price],
    );
  } catch {
    // Ignore cache write failures; lookup should still succeed without persistence.
  }
}

async function fetchFromCheapCharts(imdbId: string, title: string): Promise<AppleTvLinkResult> {
  const searchTerm = encodeURIComponent(title);
  const url =
    `https://buster.cheapcharts.de/v1/SearchForItems.php?store=itunes&itemType=all&country=us` +
    `&searchTerm=${searchTerm}&offset=0&limit=100&action=search2`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "24p/1.0" },
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { url: null, price: null };

    const data = (await response.json()) as CheapChartsSearchResponse;
    const candidates = flattenObjects(data.results);
    const match = candidates.find((entry) => entry.imdbId === imdbId);
    return toLinkResult(match);
  } catch {
    return { url: null, price: null };
  }
}

async function fetchFromStrawberry(imdbId: string, title: string): Promise<AppleTvLinkResult> {
  const base = getStrawberryBaseUrl();
  if (!base) {
    return { url: null, price: null };
  }

  const url = new URL("/cheapcharts", base);
  url.searchParams.set("imdbID", imdbId);
  url.searchParams.set("title", title);

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return { url: null, price: null };
    }
    const data = (await response.json()) as CheapChartsPayload;
    return toLinkResult(data);
  } catch {
    return { url: null, price: null };
  }
}

export async function fetchAppleTvLink(
  imdbId: string,
  title: string,
): Promise<AppleTvLinkResult> {
  const cached = await readAppleCache(imdbId);
  if (cached) return cached;

  const direct = await fetchFromCheapCharts(imdbId, title);
  if (direct.url) {
    await writeAppleCache(imdbId, title, direct);
    return direct;
  }

  const fallback = await fetchFromStrawberry(imdbId, title);
  await writeAppleCache(imdbId, title, fallback);
  return fallback;
}
