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
  sort?: string | null;
  dir?: string | null;
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
  sort,
  dir,
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

  useEffect(() => {
    setListMovieIds(tmdbIds);
  }, [tmdbIds]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!listMovieIds.length) {
        setMovies([]);
        return;
      }
      setLoading(true);
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

      const fetched: SimplifiedMovie[] = [];
      if (missing.length) {
        const concurrency = 6;
        for (let i = 0; i < missing.length; i += concurrency) {
          const chunk = missing.slice(i, i + concurrency);
          const results = await Promise.allSettled(
            chunk.map((id) => rustApiFetch<{ detail: SimplifiedMovie }>(`/tmdb/movie/${id}`)),
          );
          results.forEach((result, index) => {
            if (result.status === "fulfilled" && result.value?.detail) {
              fetched.push(result.value.detail);
              try {
                window.sessionStorage.setItem(`tmdb:${chunk[index]}`, JSON.stringify(result.value.detail));
              } catch {
                // ignore cache write errors
              }
            }
          });
        }
      }

      if (!cancelled) {
        setMovies([...cached, ...fetched]);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [listMovieIds, listSlug]);

  const sorted = useMemo(() => {
    const filtered = movies.filter((movie) => listMovieIds.includes(movie.tmdbId));
    if (!filtered.length) return filtered;
    const direction = dir === "asc" || dir === "desc" ? dir : "desc";
    const position = new Map<number, number>();
    listMovieIds.forEach((id, index) => position.set(id, index));

    const scoreFor = (movie: SimplifiedMovie) => {
      if (sort === "imdb") {
        return typeof movie.imdbRating === "number" ? movie.imdbRating : null;
      }
      if (sort === "letterboxd") {
        return typeof movie.letterboxdRating === "number" ? movie.letterboxdRating : null;
      }
      if (sort === "rating") {
        const userRating = ratingsMap[movie.tmdbId];
        if (typeof userRating === "number") return userRating;
        if (typeof movie.rating === "number") return movie.rating;
        return null;
      }
      return null;
    };

    const sortedMovies = [...filtered].sort((a, b) => {
      const scoreA = scoreFor(a);
      const scoreB = scoreFor(b);
      if (scoreA !== null && scoreB !== null && scoreA !== scoreB) {
        return direction === "asc" ? scoreA - scoreB : scoreB - scoreA;
      }
      if (scoreA === null && scoreB !== null) return 1;
      if (scoreB === null && scoreA !== null) return -1;
      const indexA = position.get(a.tmdbId) ?? Number.MAX_SAFE_INTEGER;
      const indexB = position.get(b.tmdbId) ?? Number.MAX_SAFE_INTEGER;
      return indexA - indexB;
    });

    return sortedMovies;
  }, [movies, ratingsMap, sort, dir, tmdbIds]);

  const exportRows = useMemo(() => {
    return sorted.map((movie) => {
      const userRating = ratingsMap[movie.tmdbId];
      return [
        listTitle,
        movie.title,
        movie.tmdbId.toString(),
        movie.releaseYear ? movie.releaseYear.toString() : "",
        typeof userRating === "number" ? userRating.toString() : "",
        typeof movie.rating === "number" ? movie.rating.toFixed(1) : "",
        typeof movie.imdbRating === "number" ? movie.imdbRating.toFixed(1) : "",
        typeof movie.letterboxdRating === "number" ? movie.letterboxdRating.toFixed(2) : "",
      ];
    });
  }, [listTitle, ratingsMap, sorted]);

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
    <div className="space-y-3">
      <div className="flex justify-end" style={{ paddingLeft: 16 }}>
        <button
          type="button"
          onClick={handleExport}
          disabled={loading || isExporting || !exportRows.length}
          className="rounded-full border border-black-700 px-4 py-1 text-xs font-semibold text-black-100 transition hover:border-black-500 hover:text-white disabled:cursor-not-allowed disabled:border-black-800 disabled:text-black-500"
        >
          {isExporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      {loading && movies.length === 0 ? <p className="text-sm text-black-500">Loading movies…</p> : null}
      {sorted.length === 0 && !loading ? (
        <p className="text-sm text-black-500">No movies yet. Add some from the detail pages.</p>
      ) : (
        <ul
          className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
          style={{ paddingLeft: 16 }}
        >
          {sorted.map((movie) => (
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
                    className="absolute right-1 top-1 z-10 rounded-full border border-rose-300/70 bg-rose-600 px-2 py-1 text-[11px] font-bold text-white shadow hover:bg-rose-500 disabled:opacity-60"
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
                {(() => {
                  if (!sort) return null;
                  const userRating = ratingsMap[movie.tmdbId];
                  let value: string | null = null;
                  if (sort === "rating") {
                    if (typeof userRating === "number") value = userRating.toString();
                    else if (typeof movie.rating === "number") value = movie.rating.toFixed(1);
                  } else if (sort === "imdb" && typeof movie.imdbRating === "number") {
                    value = movie.imdbRating.toFixed(1);
                  } else if (sort === "letterboxd" && typeof movie.letterboxdRating === "number") {
                    value = movie.letterboxdRating.toFixed(2);
                  }
                  if (!value) return null;
                  return (
                    <span
                      className="absolute bottom-1 right-1 rounded-md px-2 py-1 text-[10px] font-medium text-white"
                      style={{ backgroundColor: "#000" }}
                    >
                      {value}
                    </span>
                  );
                })()}
              </Link>
            </li>
          ))}
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
