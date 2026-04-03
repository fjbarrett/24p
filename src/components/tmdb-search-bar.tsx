"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { SimplifiedArtist, SimplifiedMovie } from "@/lib/tmdb";
import { rustApiFetch } from "@/lib/rust-api-client";
import { addMovieToList, type SavedList } from "@/lib/list-store";
import { Plus, Search } from "lucide-react";

type TmdbSearchBarProps = {
  lists: SavedList[];
  userEmail: string;
};

export function TmdbSearchBar({ lists, userEmail }: TmdbSearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SimplifiedMovie[]>([]);
  const [artists, setArtists] = useState<SimplifiedArtist[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMovieId, setActiveMovieId] = useState<number | null>(null);
  const [selectedListId, setSelectedListId] = useState<string>(lists[0]?.id ?? "");
  const [savingMovieId, setSavingMovieId] = useState<number | null>(null);
  const [status, setStatus] = useState<{ movieId: number; message: string; tone: "success" | "error" } | null>(null);
  const errorId = useId();
  const panelId = useId();
  const resultsId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedEmail = userEmail.trim().toLowerCase();
  useEffect(() => {
    if (lists.length && !selectedListId) {
      setSelectedListId(lists[0]?.id ?? "");
    }
  }, [lists, selectedListId]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setArtists([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const networkTimeoutMs = 5000;
    const timeout = setTimeout(async () => {
      const networkTimeout = setTimeout(() => {
        controller.abort();
      }, networkTimeoutMs);
      try {
        setIsSearching(true);
        const payload = await rustApiFetch<{ results: SimplifiedMovie[]; artists?: SimplifiedArtist[] }>(
          `/tmdb/search?query=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setResults(payload.results ?? []);
          setArtists(payload.artists ?? []);
          setError(null);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setResults([]);
        setArtists([]);
        setError(err instanceof Error ? err.message : "Unexpected TMDB error.");
      } finally {
        clearTimeout(networkTimeout);
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

  const displayResults = results.filter((movie) => Boolean(movie.posterUrl));
  const displayArtists = artists.filter((artist) => artist.name);

  const showResultsPanel = query.trim().length >= 2 || isSearching || !!error;

  const noLists = !lists.length;

  async function handleAdd(movieId: number) {
    if (!normalizedEmail) {
      setStatus({ movieId, message: "Sign in to save movies.", tone: "error" });
      return;
    }
    if (!selectedListId) {
      setStatus({ movieId, message: "Select a list first.", tone: "error" });
      return;
    }
    try {
      setSavingMovieId(movieId);
      setStatus(null);
      await addMovieToList(selectedListId, movieId, normalizedEmail);
      setStatus({ movieId, message: "Added to list.", tone: "success" });
      setActiveMovieId(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unable to add movie.";
      setStatus({ movieId, message: detail, tone: "error" });
    } finally {
      setSavingMovieId(null);
    }
  }

  return (
    <div className="relative w-full sm:w-auto sticky top-3 z-50 mx-auto" role="search" aria-label="Movie search">
      <div className="flex items-center justify-center gap-2">
        <div className="relative flex w-full max-w-[480px] items-center gap-3 overflow-hidden rounded-3xl bg-black-950/70 px-4 py-3 shadow-inner transition">
          <span className="flex items-center justify-center rounded-full p-2 text-white" aria-hidden>
            <Search className="h-5 w-5" />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder="Search"
            aria-label="Search movies"
            aria-controls={resultsId}
            aria-describedby={error ? errorId : undefined}
            className="w-full flex-1 bg-transparent text-lg text-black-100 placeholder:text-black-400 focus:outline-none"
          />
        </div>
        {isSearching && <span className="text-xs text-black-500">Searching...</span>}
      </div>
      {error && (
        <p className="mt-2 text-xs text-rose-300" role="alert" aria-live="assertive" id={errorId}>
          {error}
        </p>
      )}
      {showResultsPanel && (
        <div
          className="absolute left-1/2 top-14 z-40 w-[min(90vw,720px)] max-h-[70vh] -translate-x-1/2 space-y-3 overflow-y-auto rounded-3xl bg-black p-4 backdrop-blur"
          id={panelId}
          aria-label="Search results"
        >
          <ul
            className="space-y-3"
            id={resultsId}
            aria-live="polite"
            aria-busy={isSearching}
            aria-label="Search results"
          >
            {displayResults.map((movie) => (
              <li key={movie.tmdbId}>
                <div className="flex items-center gap-3 rounded-3xl bg-black-900/70 p-4 transition hover:bg-black-800/70">
                  <Link
                    href={`/movies/${movie.tmdbId}`}
                    className="flex flex-1 gap-3"
                    aria-label={`${movie.title}${movie.releaseYear ? ` (${movie.releaseYear})` : ""}`}
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
                  <button
                    type="button"
                    aria-label={`Add ${movie.title} to a list`}
                    aria-controls={`add-to-list-${movie.tmdbId}`}
                    aria-expanded={activeMovieId === movie.tmdbId}
                    disabled={noLists || !normalizedEmail}
                    onClick={() => {
                      if (noLists || !normalizedEmail) return;
                      setActiveMovieId((current) => (current === movie.tmdbId ? null : movie.tmdbId));
                      setSelectedListId((current) => (current || lists[0]?.id) ?? "");
                      setStatus(null);
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition hover:brightness-95 active:brightness-90 disabled:opacity-40"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                {activeMovieId === movie.tmdbId && (
                  <div
                    id={`add-to-list-${movie.tmdbId}`}
                    className="mt-2 space-y-2 rounded-2xl bg-black-900/80 p-3 shadow-inner"
                  >
                    {noLists ? (
                      <p className="text-sm text-black-400">Create a list first to save movies.</p>
                    ) : (
                      <>
                        <label className="sr-only" htmlFor={`list-picker-${movie.tmdbId}`}>
                          Select a list
                        </label>
                        <select
                          id={`list-picker-${movie.tmdbId}`}
                          value={selectedListId}
                          onChange={(event) => setSelectedListId(event.target.value)}
                          className="w-full rounded-2xl bg-black-800/80 px-3 py-2 text-sm text-black-100 outline-none"
                        >
                          {lists.map((list) => (
                            <option key={list.id} value={list.id} className="bg-black-900 text-black-100">
                              {list.title}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="flex w-full items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:brightness-95 active:brightness-90 disabled:opacity-60"
                          onClick={() => handleAdd(movie.tmdbId)}
                          disabled={savingMovieId === movie.tmdbId}
                        >
                          {savingMovieId === movie.tmdbId ? "Adding..." : "Add to list"}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {status && status.movieId === movie.tmdbId && (
                  <p
                    className={`mt-1 text-xs ${
                      status.tone === "success" ? "text-emerald-300" : "text-rose-300"
                    }`}
                    role="status"
                  >
                    {status.message}
                  </p>
                )}
              </li>
            ))}
            {displayArtists.length > 0 && (
              <li>
                <p className="text-[11px] uppercase tracking-[0.4em] text-black-500">Artists</p>
                <div className="mt-2 space-y-2">
                  {displayArtists.map((artist) => (
                    <Link
                      key={artist.tmdbId}
                      href={`/artists/${artist.tmdbId}`}
                      className="flex items-center gap-3 rounded-2xl bg-black-900/70 px-3 py-2 transition hover:bg-black-800/70"
                    >
                      {artist.profileUrl ? (
                        <Image
                          src={artist.profileUrl}
                          alt={artist.name}
                          width={48}
                          height={48}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black-800 text-[10px] text-black-500">
                          No art
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm text-white">{artist.name}</p>
                        {artist.knownFor.length ? (
                          <p className="text-xs text-black-500">
                            {artist.knownFor.slice(0, 2).join(" • ")}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              </li>
            )}
            {!displayResults.length && !displayArtists.length && query.trim().length >= 2 && !isSearching && !error && (
              <li>
                <p className="text-sm text-black-500" role="status">
                  No matches yet. Try a different title.
                </p>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
