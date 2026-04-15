"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { SearchResultItem } from "@/lib/tmdb";
import { apiFetch } from "@/lib/api-client";
import { addMovieToList, type SavedList } from "@/lib/list-store";
import { Check, Plus, Search, X } from "lucide-react";

type TmdbSearchBarProps = {
  lists: SavedList[];
  userEmail: string;
  wide?: boolean;
  bordered?: boolean;
};

export function TmdbSearchBar({ lists, userEmail, wide = false, bordered = false }: TmdbSearchBarProps) {
  const [query, setQuery] = useState("");
  const [combined, setCombined] = useState<SearchResultItem[]>([]);
  const [panelDismissed, setPanelDismissed] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMovieId, setActiveMovieId] = useState<number | null>(null);
  const [selectedListId, setSelectedListId] = useState<string>(lists[0]?.id ?? "");
  const [savingMovieId, setSavingMovieId] = useState<number | null>(null);
  const [status, setStatus] = useState<{ movieId: number; message: string; tone: "success" | "error" } | null>(null);
  // Tracks movies added during this session so the UI stays correct without a page reload
  const [localAdditions, setLocalAdditions] = useState<Map<number, string>>(new Map());
  const errorId = useId();
  const panelId = useId();
  const resultsId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedEmail = userEmail.trim().toLowerCase();
  const pathname = usePathname();
  useEffect(() => {
    setPanelDismissed(true);
  }, [pathname]);

  useEffect(() => {
    if (lists.length && !selectedListId) {
      setSelectedListId(lists[0]?.id ?? "");
    }
  }, [lists, selectedListId]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setCombined([]);
      setPanelDismissed(false);
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
        const payload = await apiFetch<{ combined: SearchResultItem[] }>(
          `/tmdb/search?query=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setCombined(payload.combined ?? []);
          setError(null);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setCombined([]);
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

  useEffect(() => {
    if (panelDismissed) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;
      setPanelDismissed(true);
      setActiveMovieId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [panelDismissed]);

  const displayItems = combined.filter((item) =>
    item.resultType === "artist" ? Boolean(item.profileUrl) : Boolean(item.posterUrl),
  );

  const showResultsPanel = !panelDismissed && (query.trim().length >= 2 || isSearching || !!error);

  const noLists = !lists.length;
  const canManageLists = Boolean(normalizedEmail);

  function clearSearch() {
    setQuery("");
    setCombined([]);
    setError(null);
    setPanelDismissed(false);
    setActiveMovieId(null);
    inputRef.current?.focus();
  }

  // Returns the id of the first list that already contains this movie,
  // checking both server-loaded list items and adds made this session.
  function firstListContaining(tmdbId: number): string | undefined {
    const localListId = localAdditions.get(tmdbId);
    if (localListId) return localListId;
    return lists.find((l) => l.items.some((i) => i.tmdbId === tmdbId))?.id;
  }

  // True when the currently selected list already has this movie.
  function isInSelectedList(tmdbId: number): boolean {
    if (!selectedListId) return false;
    if (localAdditions.get(tmdbId) === selectedListId) return true;
    return lists.find((l) => l.id === selectedListId)?.items.some((i) => i.tmdbId === tmdbId) ?? false;
  }

  async function handleAdd(movieId: number, mediaType: "movie" | "tv" = "movie") {
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
      await addMovieToList(selectedListId, movieId, normalizedEmail, mediaType);
      setLocalAdditions((prev) => new Map(prev).set(movieId, selectedListId));
      setActiveMovieId(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unable to add movie.";
      setStatus({ movieId, message: detail, tone: "error" });
    } finally {
      setSavingMovieId(null);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full" role="search" aria-label="Movie search">
      <div className="flex items-center gap-2">
        <div className={`relative mx-auto flex w-full items-center gap-2 overflow-hidden rounded-3xl bg-black-950/70 px-3.5 py-2 shadow-inner transition ${wide ? "max-w-[760px]" : "max-w-[480px]"} ${bordered ? "border border-white/15" : ""}`}>
          <span className="flex items-center justify-center rounded-full p-1.5 text-white" aria-hidden>
            <Search className="h-4.5 w-4.5" />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setPanelDismissed(false);
              setQuery(event.target.value);
            }}
            onFocus={() => setPanelDismissed(false)}
            type="text"
            placeholder={pathname.split("/").filter(Boolean).length >= 2 ? "Search" : "Search for movies, tv, cast and crew"}
            aria-label="Search movies and shows"
            aria-controls={resultsId}
            aria-describedby={error ? errorId : undefined}
            className="w-full flex-1 bg-transparent pr-2 text-[15px] text-black-100 placeholder:text-black-400 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/55 transition hover:text-white"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          ) : null}
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
          className="search-results-scrollbar absolute left-1/2 top-12 z-40 w-[min(90vw,720px)] max-h-[70vh] -translate-x-1/2 space-y-3 overflow-y-auto rounded-3xl bg-black p-4 backdrop-blur"
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
            {displayItems.map((item) => {
              if (item.resultType === "artist") {
                return (
                  <li key={`artist-${item.tmdbId}`}>
                    <Link
                      href={`/artists/${item.tmdbId}`}
                      className="flex items-center gap-3 rounded-2xl bg-black-900/70 px-3 py-2.5 transition hover:bg-black-800/70"
                    >
                      {item.profileUrl ? (
                        <Image
                          src={item.profileUrl}
                          alt={item.name}
                          width={48}
                          height={64}
                          className="h-16 w-12 flex-shrink-0 rounded-xl object-cover object-top"
                        />
                      ) : (
                        <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-black-800 text-[10px] text-black-500">
                          No art
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white leading-snug">{item.name}</p>
                      </div>
                    </Link>
                  </li>
                );
              }

              const isShow = item.mediaType === "tv";
              const detailHref = isShow ? `/tv/${item.tmdbId}` : `/movies/${item.tmdbId}`;
              return (
                <li key={`movie-${item.tmdbId}`}>
                  <div className="flex items-center gap-3 rounded-2xl bg-black-900/70 px-3 py-2.5 transition hover:bg-black-800/70">
                    <Link
                      href={detailHref}
                      className="flex flex-1 items-center gap-3"
                      aria-label={`${item.title}${item.releaseYear ? ` (${item.releaseYear})` : ""}`}
                    >
                      {item.posterUrl ? (
                        <Image
                          src={item.posterUrl}
                          alt={`${item.title} poster`}
                          width={48}
                          height={64}
                          className="h-16 w-12 flex-shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-black-800 text-xs text-black-500">
                          No art
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-normal text-white leading-snug">
                          {item.title}{item.releaseYear ? <span className="text-black-500"> ({item.releaseYear})</span> : null}
                        </h4>
                        {item.genres?.length ? (
                          <p className="mt-0.5 text-xs text-black-500">{item.genres.slice(0, 2).join(" · ")}</p>
                        ) : null}
                      </div>
                    </Link>
                    {canManageLists ? (
                      <button
                        type="button"
                        aria-label={`Add ${item.title} to a list`}
                        aria-controls={`add-to-list-${item.tmdbId}`}
                        aria-expanded={activeMovieId === item.tmdbId}
                        disabled={noLists}
                        onClick={() => {
                          if (noLists) return;
                          const isOpen = activeMovieId === item.tmdbId;
                          setActiveMovieId(isOpen ? null : item.tmdbId);
                          if (!isOpen) {
                            const existing = firstListContaining(item.tmdbId);
                            setSelectedListId(existing ?? selectedListId ?? lists[0]?.id ?? "");
                          }
                          setStatus(null);
                        }}
                        className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:brightness-95 active:brightness-90 disabled:opacity-40"
                      >
                        {firstListContaining(item.tmdbId)
                          ? <Check className="h-5 w-5" />
                          : <Plus className="h-5 w-5" />}
                      </button>
                    ) : null}
                  </div>

                  {activeMovieId === item.tmdbId && (
                    <div
                      id={`add-to-list-${item.tmdbId}`}
                      className="mt-2 space-y-2 rounded-2xl bg-black-900/80 p-3 shadow-inner"
                    >
                      {noLists ? (
                        <p className="text-sm text-black-400">Create a list first to save movies.</p>
                      ) : (
                        <>
                          <label className="sr-only" htmlFor={`list-picker-${item.tmdbId}`}>
                            Select a list
                          </label>
                          <select
                            id={`list-picker-${item.tmdbId}`}
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
                            className="flex w-full items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:brightness-95 active:brightness-90 disabled:opacity-50"
                            onClick={() => handleAdd(item.tmdbId, isShow ? "tv" : "movie")}
                            disabled={savingMovieId === item.tmdbId || isInSelectedList(item.tmdbId)}
                          >
                            {savingMovieId === item.tmdbId
                              ? "Adding..."
                              : isInSelectedList(item.tmdbId)
                                ? "Added"
                                : "Add to list"}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {status && status.movieId === item.tmdbId && (
                    <p
                      className={`mt-1 text-xs ${status.tone === "success" ? "text-emerald-300" : "text-rose-300"}`}
                      role="status"
                    >
                      {status.message}
                    </p>
                  )}
                </li>
              );
            })}
            {!displayItems.length && query.trim().length >= 2 && !isSearching && !error && (
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
