import "server-only";

import { getPool } from "@/lib/server/db";
import { fetchJustWatchOffers } from "@/lib/server/justwatch";
import { fetchTmdbMovie, fetchTmdbShow } from "@/lib/server/tmdb";
import { sendStreamingDigest, type StreamingChangeItem } from "@/lib/server/email";

// Only subscription-tier offers count as "streaming" for notification purposes.
const NOTIFY_ACCESS_MODELS = new Set(["subscription", "free", "ads"]);

// Delay between TMDB fetches to avoid hammering the API.
const FETCH_DELAY_MS = 300;

type TitleSnapshot = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  releaseYear: number | null;
  posterUrl: string | null;
  providerShortNames: string[];
};

type SnapshotRow = {
  tmdb_id: number;
  media_type: string;
  title: string;
  release_year: number | null;
  poster_url: string | null;
  provider_short_names: string[];
};

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function loadSnapshots(): Promise<Map<string, TitleSnapshot>> {
  const pool = getPool();
  const result = await pool.query<SnapshotRow>(
    "SELECT tmdb_id, media_type, title, release_year, poster_url, provider_short_names FROM streaming_snapshots",
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
      providerShortNames: row.provider_short_names ?? [],
    });
  }
  return map;
}

async function upsertSnapshot(snapshot: TitleSnapshot & { providerShortNames: string[] }): Promise<void> {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO streaming_snapshots
        (tmdb_id, media_type, title, release_year, poster_url, provider_short_names, last_checked_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (tmdb_id, media_type)
      DO UPDATE SET
        title                = EXCLUDED.title,
        release_year         = EXCLUDED.release_year,
        poster_url          = EXCLUDED.poster_url,
        provider_short_names = EXCLUDED.provider_short_names,
        last_checked_at      = NOW()
    `,
    [
      snapshot.tmdbId,
      snapshot.mediaType,
      snapshot.title,
      snapshot.releaseYear,
      snapshot.posterUrl,
      snapshot.providerShortNames,
    ],
  );
}

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

// Returns emails of users who have opted in AND have this title in at least one list.
async function findSubscribedUsersForTitle(tmdbId: number): Promise<string[]> {
  const pool = getPool();
  const result = await pool.query<{ user_email: string }>(
    `
      SELECT DISTINCT l.user_email
      FROM list_items li
      JOIN lists l ON l.id = li.list_id
      JOIN profiles p ON p.user_email = l.user_email
      WHERE li.tmdb_id = $1
        AND p.streaming_notifications = true
    `,
    [tmdbId],
  );
  return result.rows.map((row) => row.user_email.trim().toLowerCase());
}

export async function runStreamingNotificationCheck(): Promise<{ notified: number; checked: number }> {
  const items = await loadDistinctListItems();
  if (!items.length) return { notified: 0, checked: 0 };

  const snapshots = await loadSnapshots();

  // Map from userEmail → list of changed titles
  const pendingDigests = new Map<string, StreamingChangeItem[]>();

  let checked = 0;

  for (const item of items) {
    const key = `${item.tmdbId}:${item.mediaType}`;
    const existing = snapshots.get(key);

    // Fetch title metadata — use snapshot if we already have it, otherwise hit TMDB.
    let title: string;
    let releaseYear: number | null;
    let posterUrl: string | null;

    if (existing?.title) {
      title = existing.title;
      releaseYear = existing.releaseYear;
      posterUrl = existing.posterUrl;
    } else {
      try {
        const meta =
          item.mediaType === "tv"
            ? await fetchTmdbShow(item.tmdbId)
            : await fetchTmdbMovie(item.tmdbId, true);
        title = meta.title;
        releaseYear = meta.releaseYear ?? null;
        posterUrl = meta.posterUrl ?? null;
        await sleep(FETCH_DELAY_MS);
      } catch {
        console.warn(`[streaming-notifications] Failed to fetch TMDB metadata for ${item.tmdbId}`);
        continue;
      }
    }

    // Fetch current JustWatch providers.
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
      console.warn(`[streaming-notifications] Failed to fetch JustWatch offers for ${title}`);
    }

    // Diff against stored snapshot.
    const prevProviders = new Set(existing?.providerShortNames ?? []);
    const newProviders = currentProviders.filter((p) => !prevProviders.has(p));

    // Update snapshot regardless of whether there are new providers.
    await upsertSnapshot({ tmdbId: item.tmdbId, mediaType: item.mediaType, title, releaseYear, posterUrl, providerShortNames: currentProviders });
    checked += 1;

    if (!newProviders.length) continue;

    // Map provider short names to display names using the offers already fetched.
    const providerDisplayNames = newProviders.map((shortName) => {
      const match = jwOffers.find((o) => o.providerShortName.toLowerCase() === shortName);
      return match?.providerName ?? shortName;
    });

    // Find opted-in users who have this title listed.
    const users = await findSubscribedUsersForTitle(item.tmdbId);
    for (const email of users) {
      const existing = pendingDigests.get(email) ?? [];
      existing.push({ tmdbId: item.tmdbId, title, releaseYear, posterUrl, newProviderNames: providerDisplayNames });
      pendingDigests.set(email, existing);
    }
  }

  // Send one digest per user.
  let notified = 0;
  for (const [email, changes] of pendingDigests.entries()) {
    try {
      await sendStreamingDigest(email, changes);
      notified += 1;
    } catch (error) {
      console.error(`[streaming-notifications] Failed to send digest to ${email}`, error);
    }
  }

  return { notified, checked };
}
