"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { SimplifiedMovie } from "@/lib/tmdb";
import { rustApiFetch } from "@/lib/rust-api-client";

type ListComposerProps = {
  movies: SimplifiedMovie[];
};

type DraftMovie = {
  id: string;
  source: "suggested" | "tmdb";
  tmdbId: number;
  title: string;
  releaseYear?: number;
  runtime?: number;
  rating?: number;
  posterUrl?: string | null;
  overview?: string | null;
  genres?: string[];
  tagline?: string | null;
};

const MAX_MOVIES = 12;

function buildSuggested(movie: SimplifiedMovie): DraftMovie {
  return {
    id: `suggested-${movie.tmdbId}`,
    source: "suggested",
    tmdbId: movie.tmdbId,
    title: movie.title,
    releaseYear: movie.releaseYear,
    runtime: movie.runtime,
    rating: movie.rating,
    posterUrl: movie.posterUrl,
    overview: movie.overview,
    genres: movie.genres,
    tagline: movie.tagline,
  };
}

function truncate(text?: string | null, limit = 140) {
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export function ListComposer({ movies }: ListComposerProps) {
  const [title, setTitle] = useState("July Premieres");
  const [isPublic, setIsPublic] = useState(true);
  const [selected, setSelected] = useState<DraftMovie[]>(() => movies.slice(0, 3).map(buildSuggested));
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SimplifiedMovie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [addingMovieId, setAddingMovieId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, SimplifiedMovie>>({});

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setIsSearching(false);
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const delay = setTimeout(async () => {
      try {
        setIsSearching(true);
        const payload = await rustApiFetch<{ results: SimplifiedMovie[] }>(
          `/tmdb/search?query=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setSearchResults(payload.results ?? []);
          setSearchError(null);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : "Unexpected TMDB error.");
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(delay);
    };
  }, [query]);

  const selectedCount = selected.length;
  const remainingSlots = MAX_MOVIES - selectedCount;
  const selectedIds = useMemo(() => new Set(selected.map((movie) => movie.id)), [selected]);

  function toggleSuggested(movie: SimplifiedMovie) {
    const candidate = buildSuggested(movie);
    setSelected((previous) => {
      const exists = previous.some((entry) => entry.id === candidate.id);
      if (exists) {
        return previous.filter((entry) => entry.id !== candidate.id);
      }
      if (previous.length >= MAX_MOVIES) {
        return previous;
      }
      return [...previous, candidate];
    });
  }

  async function addTmdbResult(movie: SimplifiedMovie) {
    if (selected.length >= MAX_MOVIES) return;
    if (selected.some((entry) => entry.tmdbId === movie.tmdbId)) return;

    setDetailError(null);
    setAddingMovieId(movie.tmdbId);

    try {
      let detail = detailCache[movie.tmdbId];
      if (!detail) {
        const payload = await rustApiFetch<{ detail: SimplifiedMovie }>(`/tmdb/movie/${movie.tmdbId}`);
        detail = payload.detail;
        setDetailCache((previous) => ({ ...previous, [movie.tmdbId]: detail }));
      }

      const enriched: DraftMovie = {
        id: `tmdb-${movie.tmdbId}`,
        source: "tmdb",
        tmdbId: movie.tmdbId,
        title: detail.title || movie.title,
        releaseYear: detail.releaseYear ?? movie.releaseYear,
        runtime: detail.runtime ?? movie.runtime,
        rating: detail.rating ?? movie.rating,
        posterUrl: detail.posterUrl ?? movie.posterUrl,
        overview: detail.overview ?? movie.overview,
        genres: detail.genres ?? movie.genres,
        tagline: detail.tagline ?? movie.tagline,
      };

      setSelected((previous) => {
        if (previous.length >= MAX_MOVIES) return previous;
        if (previous.some((entry) => entry.tmdbId === movie.tmdbId)) return previous;
        return [...previous, enriched];
      });
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to load TMDB details.");
    } finally {
      setAddingMovieId(null);
    }
  }

  function removeMovie(id: string) {
    setSelected((previous) => previous.filter((movie) => movie.id !== id));
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-black-900/40 p-6 shadow-xl">
      <p className="text-xs uppercase tracking-[0.3em] text-black-400">Build a list</p>
      <div className="mt-3 flex flex-col gap-3">
        <label className="text-sm text-black-400">
          List title
          <input
            className="mt-1 w-full rounded-2xl border border-black-700 bg-black-950/60 px-3 py-2 text-sm text-black-100 focus:border-black-400 focus:outline-none"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={42}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-black-300">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            className="h-4 w-4 rounded border-black-600 bg-black-950 accent-black-300"
          />
          Public list (shareable link)
        </label>
        <p className="text-xs text-black-500">
          You can pin up to {MAX_MOVIES} titles. <span className="text-black-300">{remainingSlots}</span> slot
          {remainingSlots === 1 ? "" : "s"} left.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-black-500">Starter picks</p>
        {movies.map((movie) => {
          const isSelected = selectedIds.has(`suggested-${movie.tmdbId}`);
          return (
            <button
              key={movie.tmdbId}
              onClick={() => toggleSuggested(movie)}
              className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm transition ${
                isSelected
                  ? "border-black-300/80 bg-black-200/10 text-black-50"
                  : "border-black-700/60 text-black-400 hover:border-black-400/40"
              }`}
            >
              <span>
                {movie.title}
                {movie.releaseYear && <span className="ml-2 text-xs text-black-500">{movie.releaseYear}</span>}
              </span>
              <span>{typeof movie.rating === "number" ? `${movie.rating.toFixed(1)}/10` : "—"}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-black-800 bg-black-950/40 p-4">
        <p className="text-xs uppercase tracking-[0.3em] text-black-500">Search TMDB</p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search millions of films..."
          className="mt-2 w-full rounded-2xl border border-black-800 bg-black-950/70 px-3 py-2 text-sm text-black-100 placeholder:text-black-600 focus:border-black-400 focus:outline-none"
        />
        {searchError && <p className="mt-2 text-xs text-rose-300">{searchError}</p>}
        {detailError && !searchError && <p className="mt-2 text-xs text-rose-300">{detailError}</p>}
        <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1 text-sm">
          {isSearching && <p className="text-black-500">Searching TMDB...</p>}
          {!isSearching && searchResults.length === 0 && !searchError && query.trim().length >= 2 && (
            <p className="text-black-500">No matches yet. Try a different title.</p>
          )}
          {searchResults.map((result) => {
            const alreadySelected = selected.some((movie) => movie.tmdbId === result.tmdbId);
            return (
              <div
                key={result.tmdbId}
                className="flex items-center gap-3 rounded-2xl border border-black-800/80 bg-black-900/60 p-3"
              >
                {result.posterUrl ? (
                  <Image
                    src={result.posterUrl}
                    alt={`${result.title} poster`}
                    width={48}
                    height={72}
                    className="h-16 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-12 items-center justify-center rounded-lg bg-black-800 text-xs text-black-500">
                    No art
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-black-50">
                    {result.title}{" "}
                    {result.releaseYear && <span className="text-xs text-black-500">({result.releaseYear})</span>}
                  </p>
                  {typeof result.rating === "number" && (
                    <p className="text-xs text-black-500">Community score: {result.rating.toFixed(1)}/10</p>
                  )}
                </div>
                <button
                  onClick={() => addTmdbResult(result)}
                  disabled={alreadySelected || selected.length >= MAX_MOVIES || addingMovieId === result.tmdbId}
                  className="rounded-full border border-black-400 px-3 py-1 text-xs font-semibold text-black-200 transition enabled:hover:bg-black-300/10 disabled:opacity-50"
                >
                  {alreadySelected ? "Added" : addingMovieId === result.tmdbId ? "Adding..." : "Add"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-black-950/60 p-4">
        <p className="text-xs uppercase tracking-[0.3em] text-black-500">Preview</p>
        <h4 className="mt-2 text-lg font-semibold text-black-50">{title || "Untitled"}</h4>
        <p className="text-xs text-black-400">
          {isPublic ? "Public" : "Private"} • {selectedCount} film{selectedCount === 1 ? "" : "s"}
        </p>
        <ol className="mt-3 space-y-3 text-sm text-black-200">
          {selected.map((movie, index) => {
            const overview = truncate(movie.overview);
            return (
              <li key={movie.id} className="flex flex-col gap-2 rounded-xl border border-black-800/70 p-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-black-500">{index + 1}.</span>
                  {movie.posterUrl ? (
                    <Image
                      src={movie.posterUrl}
                      alt={`${movie.title} poster`}
                      width={36}
                      height={54}
                      className="h-12 w-9 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-9 items-center justify-center rounded-md bg-black-800 text-[10px] text-black-400">
                      24p
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-black-50">
                      {movie.title}{" "}
                      {movie.releaseYear && <span className="text-xs text-black-500">({movie.releaseYear})</span>}
                    </p>
                    <p className="text-xs text-black-500">
                      {movie.source === "tmdb" ? "TMDB search" : "24p pick"}
                      {movie.runtime ? ` • ${movie.runtime}m` : ""}
                      {typeof movie.rating === "number" ? ` • ${movie.rating.toFixed(1)}/10` : ""}
                    </p>
                    {movie.tagline && <p className="text-xs italic text-black-400">“{movie.tagline}”</p>}
                    {overview && <p className="text-xs text-black-500">{overview}</p>}
                    {movie.genres?.length ? (
                      <p className="text-[11px] text-black-500">{movie.genres.slice(0, 3).join(" • ")}</p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => removeMovie(movie.id)}
                    className="text-xs text-black-400 transition hover:text-rose-300"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
          {selected.length === 0 && <li className="text-black-500">Select a film to start curating.</li>}
        </ol>
      </div>
    </div>
  );
}
