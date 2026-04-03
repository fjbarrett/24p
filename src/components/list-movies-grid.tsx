"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { rustApiFetch } from "@/lib/rust-api-client";
import type { SavedList } from "@/lib/list-store";
import type { SimplifiedMovie } from "@/lib/tmdb";

type ListMoviesGridProps = {
  tmdbIds: number[];
  ratingsMap: Record<number, number>;
  fromParam: string;
  listSlug: string;
  listTitle: string;
  listId?: string;
  userEmail?: string | null;
  isEditing?: boolean;
};

export function ListMoviesGrid({
  tmdbIds,
  ratingsMap,
  fromParam,
  listSlug,
  listTitle,
  listId,
  userEmail,
  isEditing = false,
}: ListMoviesGridProps) {
  const [movies, setMovies] = useState<SimplifiedMovie[]>([]);
  const [listMovieIds, setListMovieIds] = useState<number[]>(tmdbIds);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const moviesById = useMemo(() => {
    const map = new Map<number, SimplifiedMovie>();
    movies.forEach((movie) => map.set(movie.tmdbId, movie));
    return map;
  }, [movies]);

  useEffect(() => {
    setListMovieIds(tmdbIds);
  }, [tmdbIds]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function load() {
      if (!listMovieIds.length) {
        setMovies([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setMovies([]);
      const cached: SimplifiedMovie[] = [];
      const missing: number[] = [];
      listMovieIds.forEach((id) => {
        const raw = window.sessionStorage.getItem(`tmdb:${id}`);
        if (raw) {
          try {
            cached.push(JSON.parse(raw) as SimplifiedMovie);
            return;
          } catch {
            // fall through to fetch if parse fails
          }
        }
        missing.push(id);
      });

      if (!cancelled) {
        setMovies(mergeMovies([], cached));
      }

      if (!missing.length) {
        if (!cancelled) setLoading(false);
        return;
      }

      const pending: SimplifiedMovie[] = [];
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

      async function fetchOne(tmdbId: number) {
        try {
          const result = await rustApiFetch<{ detail: SimplifiedMovie }>(`/tmdb/movie/${tmdbId}?lite=true`, {
            signal: controller.signal,
          });
          if (!result?.detail) return;
          pending.push(result.detail);
          scheduleFlush();
          try {
            window.sessionStorage.setItem(`tmdb:${tmdbId}`, JSON.stringify(result.detail));
          } catch {
            // ignore cache write errors
          }
        } catch {
          // ignore individual lookup failures
        }
      }

      const concurrency = Math.min(8, missing.length);
      let cursor = 0;
      const workers = Array.from({ length: concurrency }, async () => {
        while (!cancelled) {
          const index = cursor;
          cursor += 1;
          if (index >= missing.length) break;
          await fetchOne(missing[index]);
        }
      });

      await Promise.all(workers);

      if (flushTimer) {
        clearTimeout(flushTimer);
        flush();
      }

      if (!cancelled) {
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [listMovieIds, listSlug]);

  const displayIds = useMemo(() => listMovieIds, [listMovieIds]);

  const loadedCount = useMemo(() => {
    if (!listMovieIds.length) return 0;
    let count = 0;
    listMovieIds.forEach((id) => {
      if (moviesById.has(id)) count += 1;
    });
    return count;
  }, [listMovieIds, moviesById]);

  const sortedLoadedMovies = useMemo(() => {
    return displayIds.map((id) => moviesById.get(id)).filter((movie): movie is SimplifiedMovie => Boolean(movie));
  }, [displayIds, moviesById]);

  const exportRows = useMemo(() => {
    return sortedLoadedMovies.map((movie) => {
      const userRating = ratingsMap[movie.tmdbId];
      return [
        listTitle,
        movie.title,
        movie.tmdbId.toString(),
        movie.releaseYear ? movie.releaseYear.toString() : "",
        typeof userRating === "number" ? userRating.toString() : "",
        typeof movie.rating === "number" ? movie.rating.toFixed(1) : "",
        typeof movie.imdbRating === "number" ? movie.imdbRating.toFixed(1) : "",
      ];
    });
  }, [listTitle, ratingsMap, sortedLoadedMovies]);

  const updateListCache = (updatedMovies: number[]) => {
    if (!userEmail || !listId || typeof window === "undefined") return;
    try {
      const key = `lists:${userEmail.trim().toLowerCase()}`;
      const existing = window.localStorage.getItem(key);
      if (!existing) return;
      const parsed = JSON.parse(existing) as SavedList[];
      const next = parsed.map((entry) =>
        entry.id === listId ? { ...entry, movies: updatedMovies } : entry,
      );
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore cache errors
    }
  };

  const handleRemove = async (tmdbId: number) => {
    if (!listId || !userEmail || removingId !== null) return;
    setRemovingId(tmdbId);
    try {
      const payload = await rustApiFetch<{ list: SavedList }>(`/lists/${listId}/items/${tmdbId}`, {
        method: "DELETE",
        body: JSON.stringify({ userEmail }),
      });
      const updatedMovies = Array.isArray(payload.list.movies) ? payload.list.movies : [];
      setListMovieIds(updatedMovies);
      updateListCache(updatedMovies);
    } catch {
      // ignore errors for now; could surface toast
    } finally {
      setRemovingId(null);
    }
  };

  const handleExport = () => {
    if (isExporting || !exportRows.length) return;
    setIsExporting(true);
    try {
      const headers = [
        "List Name",
        "Movie Title",
        "TMDB ID",
        "Release Year",
        "Your Rating",
        "TMDB Rating",
        "IMDb Rating",
        "Letterboxd Rating",
      ];
      const lines = [headers, ...exportRows]
        .map((row) =>
          row
            .map((value) => {
              const safe = value ?? "";
              const needsQuotes = /[",\n]/.test(safe);
              const escaped = safe.replace(/"/g, '""');
              return needsQuotes ? `"${escaped}"` : escaped;
            })
            .join(","),
        )
        .join("\n");
      const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = `${slugifyForFilename(listSlug || listTitle)}-export.csv`;
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  if (!listMovieIds.length) {
    return <p className="text-sm text-black-500">No movies yet. Add some from the detail pages.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-black-500">Movies</p>
          {loading ? (
            <p className="text-sm text-black-500">
              Loading movies… {Math.min(loadedCount, listMovieIds.length)}/{listMovieIds.length}
            </p>
          ) : (
            <p className="text-sm text-black-400">
              {listMovieIds.length} {listMovieIds.length === 1 ? "movie" : "movies"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={loading || isExporting || !exportRows.length}
          className="min-h-11 rounded-full bg-white px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-black transition hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      {sortedLoadedMovies.length === 0 && !loading ? (
        <p className="text-sm text-black-500">No movies yet. Add some from the detail pages.</p>
      ) : (
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        >
          {displayIds.map((tmdbId) => {
            const movie = moviesById.get(tmdbId);
            if (!movie) {
              return (
                <li key={tmdbId}>
                  <div className="aspect-[2/3] w-full overflow-hidden rounded-lg border border-white/10 bg-black-900/40">
                    <div className="h-full w-full animate-pulse bg-black-800/60" />
                  </div>
                </li>
              );
            }

            return (
              <li key={movie.tmdbId}>
                <Link
                  href={`/movies/${movie.tmdbId}?from=${fromParam}`}
                  className="group relative block aspect-[2/3] w-full overflow-hidden rounded-lg border border-white/10 bg-black-900/40 transition hover:border-black-400"
                >
                  {isEditing && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        handleRemove(movie.tmdbId);
                      }}
                      disabled={removingId === movie.tmdbId}
                      className="absolute right-1 top-1 z-10 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-black shadow transition hover:brightness-95 active:brightness-90 disabled:opacity-60"
                      aria-label="Remove from list"
                    >
                      ×
                    </button>
                  )}
                  {movie.posterUrl ? (
                    <Image
                      src={toSmallPoster(movie.posterUrl)}
                      alt={`${movie.title} poster`}
                      width={200}
                      height={300}
                      sizes="(max-width: 640px) 30vw, (max-width: 768px) 22vw, 160px"
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

function slugifyForFilename(value: string) {
  const base = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  return base || "list";
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
  const map = new Map<number, SimplifiedMovie>();
  existing.forEach((movie) => map.set(movie.tmdbId, movie));
  incoming.forEach((movie) => map.set(movie.tmdbId, movie));
  return Array.from(map.values());
}
