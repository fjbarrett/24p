"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SimplifiedMovie } from "@/lib/tmdb";
import { rustApiFetch } from "@/lib/rust-api-client";
import { Search } from "lucide-react";

export function TmdbSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SimplifiedMovie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setError(null);
      setIsSearching(false);
      return;
    }

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
        const payload = await rustApiFetch<{ results: SimplifiedMovie[] }>(
          `/tmdb/search?query=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
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
  }, [query, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const node = inputRef.current;
      if (node) {
        node.focus();
        const len = node.value.length;
        // Ensure caret sits at the end when the search expands.
        requestAnimationFrame(() => node.setSelectionRange(len, len));
      }
    }
  }, [isOpen]);

  const handleBlur = () => {
    // Collapse when leaving the field without any query.
    setTimeout(() => {
      if (!inputRef.current?.value.trim()) {
        setIsOpen(false);
      }
    }, 50);
  };

  const displayResults = [...results]
    .filter((movie) => Boolean(movie.posterUrl))
    .sort((a, b) => {
      const ratingDelta = (b.rating ?? -Infinity) - (a.rating ?? -Infinity);
      if (ratingDelta !== 0) return ratingDelta;
      return a.title.localeCompare(b.title);
    });

  return (
    <div className="relative w-full sm:w-auto sticky top-3 z-50">
      {!isOpen && (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="rounded-full p-3 transition hover:bg-black-800"
            aria-label="Open search"
          >
            <Search className="h-10 w-10 text-white" aria-hidden />
          </button>
        </div>
      )}
      {isOpen && (
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-[480px] overflow-hidden rounded-3xl bg-black-950/70 px-4 py-3 shadow-inner transition">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-white transition hover:bg-black-800"
              aria-label="Close search"
            >
              <Search className="h-8 w-8" aria-hidden />
            </button>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onBlur={handleBlur}
              placeholder=""
              aria-label="Search for a movie title"
              className="w-full bg-transparent pl-12 text-lg text-black-100 placeholder:text-black-400 focus:outline-none"
            />
          </div>
          {isSearching && <span className="text-xs text-black-500">Searching...</span>}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      {isOpen && (
        <div className="absolute right-0 top-14 z-40 w-[min(90vw,720px)] max-h-[70vh] space-y-3 overflow-y-auto rounded-3xl bg-black p-4 backdrop-blur">
          {displayResults.map((movie) => (
            <Link
              key={movie.tmdbId}
              href={`/movies/${movie.tmdbId}`}
              className="flex gap-3 rounded-3xl bg-black-900/70 p-4 transition hover:bg-black-800/70"
            >
              {movie.posterUrl ? (
                <Image
                  src={movie.posterUrl}
                  alt={`${movie.title} poster`}
                  width={64}
                  height={96}
                  className="h-24 w-16 rounded-xl object-cover mx-auto"
                />
              ) : (
                <div className="flex h-24 w-16 items-center justify-center rounded-xl bg-black-800 text-xs text-black-500 mx-auto">
                  No art
                </div>
              )}
              <div className="flex-1 flex flex-col justify-center text-center sm:text-left">
                <h4 className="text-base font-normal text-white leading-tight">
                  {movie.title}{" "}
                  {movie.releaseYear && <span className="text-base text-black-500">({movie.releaseYear})</span>}
                </h4>
                {movie.genres?.length ? (
                  <p className="text-sm text-black-500">{movie.genres.slice(0, 2).join(" • ")}</p>
                ) : null}
              </div>
            </Link>
          ))}
          {!displayResults.length && query.trim().length >= 2 && !isSearching && !error && (
            <p className="text-sm text-black-500">No matches yet. Try a different title.</p>
          )}
        </div>
      )}
    </div>
  );
}

function formatCommunityRatings(movie: {
  rating?: number;
  imdbRating?: number;
  letterboxdRating?: number;
}): string | null {
  const parts: string[] = [];
  if (typeof movie.imdbRating === "number") parts.push(`IMDb ${movie.imdbRating.toFixed(1)}/10`);
  if (typeof movie.letterboxdRating === "number") parts.push(`Letterboxd ${movie.letterboxdRating.toFixed(2)}/5`);
  if (!parts.length && typeof movie.rating === "number") {
    parts.push(`TMDB ${movie.rating.toFixed(1)}/10`);
  }
  return parts.length ? parts.join(" • ") : null;
}
