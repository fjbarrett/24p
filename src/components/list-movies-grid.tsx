"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { apiFetch } from "@/lib/api-client";
import { invalidateListsCache, type ListItem, type SavedList } from "@/lib/list-store";
import type { SimplifiedMovie } from "@/lib/tmdb";
import { toMovieSlug } from "@/lib/slug";

type ListMoviesGridProps = {
  items: ListItem[];
  ratingsMap: Record<number, number>;
  fromParam: string;
  listSlug: string;
  listTitle: string;
  listId?: string;
  userEmail?: string | null;
  isEditing?: boolean;
  canDelete?: boolean;
};

// TMDB movie and TV ids are separate, overlapping namespaces, so titles are
// keyed by media type + id everywhere in this component.
function titleKey(tmdbId: number, mediaType?: string) {
  return `${mediaType === "tv" ? "tv" : "movie"}:${tmdbId}`;
}

export function ListMoviesGrid({
  items,
  fromParam,
  listId,
  userEmail,
  isEditing = false,
  canDelete = false,
}: ListMoviesGridProps) {
  const [movies, setMovies] = useState<SimplifiedMovie[]>([]);
  const [listItems, setListItems] = useState<ListItem[]>(items);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const moviesByKey = useMemo(() => {
    const map = new Map<string, SimplifiedMovie>();
    movies.forEach((movie) => map.set(titleKey(movie.tmdbId, movie.mediaType), movie));
    return map;
  }, [movies]);

  useEffect(() => {
    setListItems(items);
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function load() {
      if (!listItems.length) {
        setMovies([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadFailed(false);
      setMovies([]);
      const cached: SimplifiedMovie[] = [];
      const missing: ListItem[] = [];
      listItems.forEach((item) => {
        const raw = window.sessionStorage.getItem(`tmdb:${titleKey(item.tmdbId, item.mediaType)}`);
        if (raw) {
          try {
            cached.push(JSON.parse(raw) as SimplifiedMovie);
            return;
          } catch {
            // fall through to fetch if parse fails
          }
        }
        missing.push(item);
      });

      if (!cancelled) {
        setMovies(mergeMovies([], cached));
      }

      if (!missing.length) {
        if (!cancelled) setLoading(false);
        return;
      }

      const pending: SimplifiedMovie[] = [];
      let hadError = false;
      let flushTimer: ReturnType<typeof setTimeout> | null = null;

      const flush = () => {
        if (cancelled) return;
        flushTimer = null;
        if (!pending.length) return;
        const batch = pending.splice(0, pending.length);
        setMovies((previous) => mergeMovies(previous, batch));
      };

      const scheduleFlush = () => {
        if (flushTimer) return;
        flushTimer = setTimeout(flush, 50);
      };

      // Batch lookups: one request per ~50 titles instead of one per title
      // (a 100-film list previously fired 100 requests from the browser).
      const BATCH_SIZE = 50;
      const batches: ListItem[][] = [];
      for (let start = 0; start < missing.length; start += BATCH_SIZE) {
        batches.push(missing.slice(start, start + BATCH_SIZE));
      }

      async function fetchBatch(batchItems: ListItem[]) {
        const movieIds = batchItems.filter((item) => item.mediaType !== "tv").map((item) => item.tmdbId);
        const tvIds = batchItems.filter((item) => item.mediaType === "tv").map((item) => item.tmdbId);
        const query = new URLSearchParams();
        if (movieIds.length) query.set("movies", movieIds.join(","));
        if (tvIds.length) query.set("tv", tvIds.join(","));
        try {
          const result = await apiFetch<{ titles: SimplifiedMovie[] }>(`/tmdb/titles?${query.toString()}`, {
            signal: controller.signal,
          });
          const titles = result?.titles ?? [];
          if (!titles.length) return;
          pending.push(...titles);
          scheduleFlush();
          for (const title of titles) {
            try {
              window.sessionStorage.setItem(`tmdb:${titleKey(title.tmdbId, title.mediaType)}`, JSON.stringify(title));
            } catch {
              // ignore cache write errors
            }
          }
        } catch {
          // Remember the failure: a fully failed load must not render as an
          // empty list.
          hadError = true;
        }
      }

      const concurrency = Math.min(3, batches.length);
      let cursor = 0;
      const workers = Array.from({ length: concurrency }, async () => {
        while (!cancelled) {
          const index = cursor;
          cursor += 1;
          if (index >= batches.length) break;
          await fetchBatch(batches[index]);
        }
      });

      await Promise.all(workers);

      if (flushTimer) {
        clearTimeout(flushTimer);
        flush();
      }

      if (!cancelled) {
        if (hadError) setLoadFailed(true);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [listItems, reloadNonce]);

  const loadedCount = useMemo(() => {
    if (!listItems.length) return 0;
    let count = 0;
    listItems.forEach((item) => {
      if (moviesByKey.has(titleKey(item.tmdbId, item.mediaType))) count += 1;
    });
    return count;
  }, [listItems, moviesByKey]);

  const handleRemove = async (item: ListItem) => {
    if (!listId || !userEmail || removingKey !== null) return;
    const mediaType = item.mediaType === "tv" ? "tv" : "movie";
    setRemovingKey(titleKey(item.tmdbId, item.mediaType));
    try {
      const payload = await apiFetch<{ list: SavedList }>(
        `/lists/${listId}/items/${item.tmdbId}?mediaType=${mediaType}`,
        { method: "DELETE" },
      );
      const updatedItems = Array.isArray(payload.list.items) ? payload.list.items : [];
      setListItems(updatedItems);
      invalidateListsCache(userEmail);
    } catch {
      // ignore errors for now; could surface toast
    } finally {
      setRemovingKey(null);
    }
  };

  if (!listItems.length) {
    return <p className="text-sm text-black-500">No movies yet. Add some from the detail pages.</p>;
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-sm text-black-500">
          Loading movies… {Math.min(loadedCount, listItems.length)}/{listItems.length}
        </p>
      ) : null}
      {loadedCount === 0 && !loading && loadFailed ? (
        <div className="space-y-2 text-center">
          <p className="text-sm text-black-500">Couldn&apos;t load this list&apos;s titles.</p>
          <button
            type="button"
            onClick={() => setReloadNonce((nonce) => nonce + 1)}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black transition hover:brightness-95"
          >
            Retry
          </button>
        </div>
      ) : loadedCount === 0 && !loading ? (
        <p className="text-sm text-black-500">No movies yet. Add some from the detail pages.</p>
      ) : (
        <ul className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
          {listItems.map((item) => {
            const key = titleKey(item.tmdbId, item.mediaType);
            const movie = moviesByKey.get(key);
            if (!movie) {
              return (
                <li key={key} className="w-[calc(50%-6px)] sm:w-[calc(33%-7px)] lg:w-[calc(25%-9px)]">
                  <div className="aspect-[2/3] w-full overflow-hidden rounded-lg border border-white/10 bg-black-900/40">
                    <div className="h-full w-full animate-pulse bg-black-800/60" />
                  </div>
                </li>
              );
            }

            return (
              <li key={key} className="w-[calc(50%-6px)] sm:w-[calc(33%-7px)] lg:w-[calc(25%-9px)]">
                <Link
                  href={movie.mediaType === "tv"
                    ? `/tv/${toMovieSlug(movie.title, movie.releaseYear)}`
                    : `/movies/${toMovieSlug(movie.title, movie.releaseYear)}?from=${fromParam}`}
                  className="group relative block aspect-[2/3] w-full overflow-hidden rounded-lg border border-white/10 bg-black-900/40 transition hover:border-black-400"
                >
                  {(canDelete || isEditing) && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        handleRemove(item);
                      }}
                      disabled={removingKey === key}
                      aria-label="Remove from list"
                      className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-white hover:text-black disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                        <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                      </svg>
                    </button>
                  )}
                  {movie.posterUrl ? (
                    <Image
                      src={toSmallPoster(movie.posterUrl)}
                      alt={`${movie.title} poster`}
                      width={200}
                      height={300}
                      sizes="(max-width: 640px) 26vw, (max-width: 768px) 22vw, 160px"
                      className="h-full w-full rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black-800 text-[10px] text-black-500">
                      No art
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function toSmallPoster(url: string): string {
  return url.includes("/w500/")
    ? url.replace("/w500/", "/w185/")
    : url.includes("/w342/")
      ? url.replace("/w342/", "/w185/")
      : url;
}

function mergeMovies(existing: SimplifiedMovie[], incoming: SimplifiedMovie[]) {
  if (!incoming.length) return existing;
  const map = new Map<string, SimplifiedMovie>();
  existing.forEach((movie) => map.set(titleKey(movie.tmdbId, movie.mediaType), movie));
  incoming.forEach((movie) => map.set(titleKey(movie.tmdbId, movie.mediaType), movie));
  return Array.from(map.values());
}
