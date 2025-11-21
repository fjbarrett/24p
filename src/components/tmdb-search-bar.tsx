"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SimplifiedMovie } from "@/lib/tmdb";

export function TmdbSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SimplifiedMovie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setIsSearching(true);
        const response = await fetch(`/api/tmdb/search?query=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("TMDB search is unavailable right now.");
        }
        const payload = (await response.json()) as { results: SimplifiedMovie[] };
        if (!controller.signal.aborted) {
          setResults(payload.results ?? []);
          setError(null);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(err instanceof Error ? err.message : "Unexpected TMDB error.");
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  return (
    <div>
      <div className="flex items-center gap-3 rounded-3xl border border-black-700 bg-black-950/70 px-4 py-3 shadow-inner">
        <span className="text-sm text-black-500"></span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for a movie title..."
          className="flex-1 bg-transparent text-lg text-black-100 placeholder:text-black-500 focus:outline-none"
        />
        {isSearching && <span className="text-xs text-black-500">Searching...</span>}
      </div>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {results.map((movie) => (
          <Link
            key={movie.tmdbId}
            href={`/movies/${movie.tmdbId}`}
            className="flex gap-4 rounded-3xl border border-white/5 bg-black-900/70 p-4 transition hover:border-black-400/70"
          >
            {movie.posterUrl ? (
              <Image
                src={movie.posterUrl}
                alt={`${movie.title} poster`}
                width={64}
                height={96}
                className="h-24 w-16 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-24 w-16 items-center justify-center rounded-xl bg-black-800 text-xs text-black-500">
                No art
              </div>
            )}
            <div className="flex-1">
              <h4 className="text-base font-semibold text-white">
                {movie.title} {movie.releaseYear && <span className="text-xs text-black-500">({movie.releaseYear})</span>}
              </h4>
              {movie.genres?.length ? (
                <p className="text-xs text-black-500">{movie.genres.slice(0, 2).join(" • ")}</p>
              ) : null}
              {typeof movie.rating === "number" && (
                <p className="text-xs text-black-400">Community score: {movie.rating.toFixed(1)}/10</p>
              )}
              {movie.overview && <p className="mt-2 text-sm text-black-400">{movie.overview}</p>}
            </div>
          </Link>
        ))}
        {!results.length && query.trim().length >= 2 && !isSearching && !error && (
          <p className="text-sm text-black-500">No matches yet. Try a different title.</p>
        )}
      </div>
    </div>
  );
}
