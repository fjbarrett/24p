import "server-only";

import { getPool } from "@/lib/server/db";
import { fetchJustWatchOffers } from "@/lib/server/justwatch";
import { fetchTmdbMovie, fetchTmdbShow } from "@/lib/server/tmdb";
import { fetchPricesForImdbIds } from "@/lib/server/cheapcharts";
import { sendNotificationDigest, type StreamingChangeItem, type PriceDropItem } from "@/lib/server/email";

// Only subscription/free/ad-supported offers count for streaming notifications.
const NOTIFY_ACCESS_MODELS = new Set(["subscription", "free", "ads"]);

// Delay between external API fetches to avoid hammering rate limits.
const FETCH_DELAY_MS = 300;

// Minimum price drop fraction to trigger a notification (avoids noise on $0.01 rounding).
const MIN_DROP_FRACTION = 0.05;

type TitleSnapshot = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  releaseYear: number | null;
  posterUrl: string | null;
  imdbId: string | null;
  providerShortNames: string[];
};

type SnapshotRow = {
  tmdb_id: number;
  media_type: string;
  title: string;
  release_year: number | null;
  poster_url: string | null;
  imdb_id: string | null;
  provider_short_names: string[];
};

type PriceSnapshotRow = {
  imdb_id: string;
  tmdb_id: number | null;
  title: string;
  poster_url: string | null;
  buy_price_usd: string | null; // NUMERIC comes back as string from pg
};

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ─── Streaming snapshots ─────────────────────────────────────────────────────

async function loadStreamingSnapshots(): Promise<Map<string, TitleSnapshot>> {
  const pool = getPool();
  const result = await pool.query<SnapshotRow>(
    "SELECT tmdb_id, media_type, title, release_year, poster_url, imdb_id, provider_short_names FROM streaming_snapshots",
  );
  const map = new Map<string, TitleSnapshot>();
  for (const row of result.rows) {
    const key = `${row.tmdb_id}:${row.media_type}`;
    map.set(key, {
      tmdbId: row.tmdb_id,
      mediaType: row.media_type === "tv" ? "tv" : "movie",
      title: row.title,
      releaseYear: row.release_year,
      posterUrl: row.poster_url,
      imdbId: row.imdb_id,
      providerShortNames: row.provider_short_names ?? [],
    });
  }
  return map;
}

async function upsertStreamingSnapshot(snap: TitleSnapshot): Promise<void> {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO streaming_snapshots
        (tmdb_id, media_type, title, release_year, poster_url, imdb_id, provider_short_names, last_checked_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (tmdb_id, media_type)
      DO UPDATE SET
        title                = EXCLUDED.title,
        release_year         = EXCLUDED.release_year,
        poster_url           = EXCLUDED.poster_url,
        imdb_id              = COALESCE(EXCLUDED.imdb_id, streaming_snapshots.imdb_id),
        provider_short_names = EXCLUDED.provider_short_names,
        last_checked_at      = NOW()
    `,
    [snap.tmdbId, snap.mediaType, snap.title, snap.releaseYear, snap.posterUrl, snap.imdbId, snap.providerShortNames],
  );
}

// ─── Price snapshots ──────────────────────────────────────────────────────────

async function loadPriceSnapshots(): Promise<Map<string, PriceSnapshotRow>> {
  const pool = getPool();
  const result = await pool.query<PriceSnapshotRow>(
    "SELECT imdb_id, tmdb_id, title, poster_url, buy_price_usd FROM price_snapshots",
  );
  const map = new Map<string, PriceSnapshotRow>();
  for (const row of result.rows) {
    map.set(row.imdb_id, row);
  }
  return map;
}

async function upsertPriceSnapshot(
  imdbId: string,
  tmdbId: number | null,
  title: string,
  posterUrl: string | null,
  buyPriceUsd: number | null,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO price_snapshots (imdb_id, tmdb_id, title, poster_url, buy_price_usd, last_checked_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (imdb_id)
      DO UPDATE SET
        tmdb_id         = COALESCE(EXCLUDED.tmdb_id, price_snapshots.tmdb_id),
        title           = EXCLUDED.title,
        poster_url      = COALESCE(EXCLUDED.poster_url, price_snapshots.poster_url),
        buy_price_usd   = EXCLUDED.buy_price_usd,
        last_checked_at = NOW()
    `,
    [imdbId, tmdbId, title, posterUrl, buyPriceUsd],
  );
}

// ─── User queries ─────────────────────────────────────────────────────────────

async function loadDistinctListItems(): Promise<Array<{ tmdbId: number; mediaType: "movie" | "tv" }>> {
  const pool = getPool();
  const result = await pool.query<{ tmdb_id: number; media_type: string }>(
    "SELECT DISTINCT tmdb_id, media_type FROM list_items",
  );
  return result.rows.map((row) => ({
    tmdbId: row.tmdb_id,
    mediaType: row.media_type === "tv" ? "tv" : "movie",
  }));
}

async function findUsersForTitle(
  tmdbId: number,
  column: "streaming_notifications" | "price_notifications",
): Promise<string[]> {
  const pool = getPool();
  const result = await pool.query<{ user_email: string }>(
    `
      SELECT DISTINCT l.user_email
      FROM list_items li
      JOIN lists l ON l.id = li.list_id
      JOIN profiles p ON p.user_email = l.user_email
      WHERE li.tmdb_id = $1
        AND p.${column} = true
    `,
    [tmdbId],
  );
  return result.rows.map((row) => row.user_email.trim().toLowerCase());
}

// ─── Main job ─────────────────────────────────────────────────────────────────

export async function runStreamingNotificationCheck(): Promise<{ notified: number; checked: number }> {
  const listItems = await loadDistinctListItems();
  if (!listItems.length) return { notified: 0, checked: 0 };

  const streamingSnapshots = await loadStreamingSnapshots();
  const priceSnapshots = await loadPriceSnapshots();

  // email → { streaming changes, price drops }
  const streamingPending = new Map<string, StreamingChangeItem[]>();
  const pricePending = new Map<string, PriceDropItem[]>();

  let checked = 0;

  // Collect all resolved metadata as we go so we can batch CheapCharts calls.
  // Only movies have CheapCharts support; TV seasons are excluded.
  const priceCheckQueue: Array<{
    imdbId: string;
    tmdbId: number;
    title: string;
    releaseYear: number | null;
    posterUrl: string | null;
  }> = [];

  for (const item of listItems) {
    const key = `${item.tmdbId}:${item.mediaType}`;
    const existing = streamingSnapshots.get(key);

    // ── Resolve title metadata ──────────────────────────────────────────────
    let title: string;
    let releaseYear: number | null;
    let posterUrl: string | null;
    let imdbId: string | null;

    if (existing?.title) {
      title = existing.title;
      releaseYear = existing.releaseYear;
      posterUrl = existing.posterUrl;
      imdbId = existing.imdbId;
    } else {
      try {
        const meta =
          item.mediaType === "tv"
            ? await fetchTmdbShow(item.tmdbId)
            : await fetchTmdbMovie(item.tmdbId, true);
        title = meta.title;
        releaseYear = meta.releaseYear ?? null;
        posterUrl = meta.posterUrl ?? null;
        imdbId = meta.imdbId ?? null;
        await sleep(FETCH_DELAY_MS);
      } catch {
        console.warn(`[notifications] Failed to fetch TMDB metadata for ${item.tmdbId}`);
        continue;
      }
    }

    // ── Streaming diff ──────────────────────────────────────────────────────
    let currentProviders: string[] = [];
    let jwOffers: Awaited<ReturnType<typeof fetchJustWatchOffers>> = [];
    try {
      jwOffers = await fetchJustWatchOffers(title, releaseYear ?? undefined, "US", item.mediaType);
      const seen = new Set<string>();
      for (const offer of jwOffers) {
        if (NOTIFY_ACCESS_MODELS.has(offer.accessModel) && offer.providerShortName) {
          seen.add(offer.providerShortName.toLowerCase());
        }
      }
      currentProviders = [...seen];
      await sleep(FETCH_DELAY_MS);
    } catch {
      console.warn(`[notifications] Failed to fetch JustWatch offers for "${title}"`);
    }

    const prevProviders = new Set(existing?.providerShortNames ?? []);
    const newProviders = currentProviders.filter((p) => !prevProviders.has(p));

    await upsertStreamingSnapshot({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title,
      releaseYear,
      posterUrl,
      imdbId,
      providerShortNames: currentProviders,
    });
    checked += 1;

    if (newProviders.length) {
      const providerDisplayNames = newProviders.map((shortName) => {
        const match = jwOffers.find((o) => o.providerShortName.toLowerCase() === shortName);
        return match?.providerName ?? shortName;
      });
      const users = await findUsersForTitle(item.tmdbId, "streaming_notifications");
      for (const email of users) {
        const list = streamingPending.get(email) ?? [];
        list.push({ tmdbId: item.tmdbId, title, releaseYear, posterUrl, newProviderNames: providerDisplayNames });
        streamingPending.set(email, list);
      }
    }

    // ── Queue movie for price check (TV not supported by CheapCharts) ────────
    if (item.mediaType === "movie" && imdbId) {
      priceCheckQueue.push({ imdbId, tmdbId: item.tmdbId, title, releaseYear, posterUrl });
    }
  }

  // ── Batch price lookups ───────────────────────────────────────────────────
  if (priceCheckQueue.length) {
    const imdbIds = priceCheckQueue.map((q) => q.imdbId);
    const currentPrices = await fetchPricesForImdbIds(imdbIds);

    for (const queued of priceCheckQueue) {
      const current = currentPrices.get(queued.imdbId);
      const snap = priceSnapshots.get(queued.imdbId);

      const newPrice = current?.buyPriceUsd ?? null;
      const oldPrice = snap?.buy_price_usd != null ? parseFloat(snap.buy_price_usd) : null;

      await upsertPriceSnapshot(queued.imdbId, queued.tmdbId, queued.title, queued.posterUrl, newPrice);

      // Notify on first-time price data (oldPrice was null → baseline only, no alert)
      // and on subsequent drops that exceed the minimum threshold.
      if (
        newPrice !== null &&
        oldPrice !== null &&
        newPrice < oldPrice * (1 - MIN_DROP_FRACTION)
      ) {
        const users = await findUsersForTitle(queued.tmdbId, "price_notifications");
        for (const email of users) {
          const list = pricePending.get(email) ?? [];
          list.push({
            imdbId: queued.imdbId,
            title: queued.title,
            releaseYear: queued.releaseYear,
            posterUrl: queued.posterUrl,
            oldPriceUsd: oldPrice,
            newPriceUsd: newPrice,
          });
          pricePending.set(email, list);
        }
      }
    }
  }

  // ── Send one combined digest per user ─────────────────────────────────────
  const allEmails = new Set([...streamingPending.keys(), ...pricePending.keys()]);
  let notified = 0;

  for (const email of allEmails) {
    const streaming = streamingPending.get(email) ?? [];
    const prices = pricePending.get(email) ?? [];
    try {
      await sendNotificationDigest(email, streaming, prices);
      notified += 1;
    } catch (error) {
      console.error(`[notifications] Failed to send digest to ${email}`, error);
    }
  }

  return { notified, checked };
}
