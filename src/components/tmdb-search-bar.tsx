"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { SearchResultItem } from "@/lib/tmdb";
import { apiFetch } from "@/lib/api-client";
import { addMovieToList, type SavedList } from "@/lib/list-store";
import { Check, Plus, Search, X } from "@/components/icons";
import { toMovieSlug, toArtistSlug } from "@/lib/slug";

type TmdbSearchBarProps = {
  lists: SavedList[];
  userEmail: string;
  wide?: boolean;
  bordered?: boolean;
};

// Movie and TV ids overlap, so results are identified by media type + id.
function resultKey(tmdbId: number, mediaType?: string) {
  return `${mediaType === "tv" ? "tv" : "movie"}-${tmdbId}`;
}

const ROW_CLASS = "flex items-center gap-3 rounded-[18px] px-2 py-1.5 transition hover:bg-white/6";
const FOCUS_CLASS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60";
const RATING_VOTE_FLOOR = 20;
const SKELETON_WIDTHS = ["w-[62%]", "w-[45%]", "w-[54%]"];

export function TmdbSearchBar({ lists, userEmail, wide = false, bordered = false }: TmdbSearchBarProps) {
  const [query, setQuery] = useState("");
  const [combined, setCombined] = useState<SearchResultItem[]>([]);
  const [panelDismissed, setPanelDismissed] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string>(lists[0]?.id ?? "");
  const [savingItemKey, setSavingItemKey] = useState<string | null>(null);
  const [status, setStatus] = useState<{ itemKey: string; message: string; tone: "success" | "error" } | null>(null);
  const [panelMaxHeight, setPanelMaxHeight] = useState<number>();
  // Tracks titles added during this session so the UI stays correct without a page reload
  const [localAdditions, setLocalAdditions] = useState<Map<string, string>>(new Map());
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
      setActiveItemKey(null);
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

  // The home page centres the search bar vertically, so a fixed cap would run the
  // panel off the bottom of the window. Give it whatever room is left instead.
  useEffect(() => {
    if (!showResultsPanel) return;
    const measure = () => {
      const bottom = containerRef.current?.getBoundingClientRect().bottom ?? 0;
      // Capped so the dropdown never becomes a full-height curtain under the
      // slim page header, floored so it stays usable on short windows.
      setPanelMaxHeight(Math.min(560, Math.max(240, Math.round(window.innerHeight - bottom - 24))));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [showResultsPanel]);

  const noLists = !lists.length;
  const canManageLists = Boolean(normalizedEmail);

  function clearSearch() {
    setQuery("");
    setCombined([]);
    setError(null);
    setPanelDismissed(false);
    setActiveItemKey(null);
    inputRef.current?.focus();
  }

  // Returns the id of the first list that already contains this title,
  // checking both server-loaded list items and adds made this session.
  function firstListContaining(tmdbId: number, mediaType: "movie" | "tv"): string | undefined {
    const localListId = localAdditions.get(resultKey(tmdbId, mediaType));
    if (localListId) return localListId;
    return lists.find((l) => l.items.some((i) => i.tmdbId === tmdbId && i.mediaType === mediaType))?.id;
  }

  // True when the currently selected list already has this title.
  function isInSelectedList(tmdbId: number, mediaType: "movie" | "tv"): boolean {
    if (!selectedListId) return false;
    if (localAdditions.get(resultKey(tmdbId, mediaType)) === selectedListId) return true;
    return (
      lists
        .find((l) => l.id === selectedListId)
        ?.items.some((i) => i.tmdbId === tmdbId && i.mediaType === mediaType) ?? false
    );
  }

  async function handleAdd(movieId: number, mediaType: "movie" | "tv" = "movie") {
    const itemKey = resultKey(movieId, mediaType);
    if (!normalizedEmail) {
      setStatus({ itemKey, message: "Sign in to save movies.", tone: "error" });
      return;
    }
    if (!selectedListId) {
      setStatus({ itemKey, message: "Select a list first.", tone: "error" });
      return;
    }
    try {
      setSavingItemKey(itemKey);
      setStatus(null);
      await addMovieToList(selectedListId, movieId, normalizedEmail, mediaType);
      setLocalAdditions((prev) => new Map(prev).set(itemKey, selectedListId));
      setActiveItemKey(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unable to add movie.";
      setStatus({ itemKey, message: detail, tone: "error" });
    } finally {
      setSavingItemKey(null);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full" role="search" aria-label="Movie search">
      <div className="flex items-center gap-2">
        <div className={`relative mx-auto flex w-full items-center gap-2 overflow-hidden rounded-3xl bg-black-950/70 px-3.5 py-2 shadow-inner transition ${wide ? "max-w-[760px]" : "max-w-[480px]"} ${bordered ? "border-[2.5px] border-white/15" : ""}`}>
          <span
            className={`flex items-center justify-center rounded-full p-1.5 text-white ${isSearching ? "animate-pulse" : ""}`}
            aria-hidden
          >
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
            placeholder={pathname.split("/").filter(Boolean).length >= 2 ? "Search" : "Search for movies, TV, cast and crew"}
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
      </div>
      {showResultsPanel && (
        <div
          className={`search-results-scrollbar animate-fade-slide-in absolute left-1/2 top-full z-40 mt-2 max-h-[70vh] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,#1a1a1a,#0d0d0d)] p-1.5 text-left shadow-[0_36px_120px_rgba(0,0,0,0.72)] ring-1 ring-white/5 ${wide ? "w-[min(92vw,760px)]" : "w-[min(92vw,480px)]"}`}
          style={panelMaxHeight ? { maxHeight: panelMaxHeight } : undefined}
          id={panelId}
          aria-label="Search results"
        >
          <ul
            className="space-y-0.5"
            id={resultsId}
            aria-live="polite"
            aria-busy={isSearching}
            aria-label="Search results"
          >
            {displayItems.map((item) => {
              if (item.resultType === "artist") {
                // A circular crop reads as a person at a glance, so people and
                // titles stay distinguishable without labelling every row.
                const meta = [item.department, item.knownFor.slice(0, 2).join(", ")]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={`artist-${item.tmdbId}`}>
                    <Link
                      href={`/artists/${toArtistSlug(item.name)}`}
                      className={`${ROW_CLASS} ${FOCUS_CLASS}`}
                    >
                      {item.profileUrl ? (
                        <Image
                          src={item.profileUrl}
                          alt={item.name}
                          width={44}
                          height={44}
                          className="h-11 w-11 flex-shrink-0 rounded-full object-cover object-top"
                        />
                      ) : (
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] text-black-500">
                          No art
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium leading-snug text-white">{item.name}</p>
                        {meta ? (
                          <p className="mt-1 truncate text-xs leading-none text-black-500">{meta}</p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              }

              const isShow = item.mediaType === "tv";
              const mediaType = isShow ? ("tv" as const) : ("movie" as const);
              const itemKey = resultKey(item.tmdbId, mediaType);
              const detailHref = isShow
                ? `/tv/${toMovieSlug(item.title, item.releaseYear)}`
                : `/movies/${toMovieSlug(item.title, item.releaseYear)}`;
              // TMDB averages swing hard on a handful of votes, so a score only
              // earns its place once enough people have rated the title.
              const rating =
                typeof item.rating === "number" && item.rating > 0 && (item.voteCount ?? 0) >= RATING_VOTE_FLOOR
                  ? item.rating.toFixed(1)
                  : null;
              const savedListId = firstListContaining(item.tmdbId, mediaType);
              return (
                <li key={itemKey}>
                  <div className={ROW_CLASS}>
                    <Link
                      href={detailHref}
                      className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl ${FOCUS_CLASS}`}
                      aria-label={`${item.title}${item.releaseYear ? `, ${item.releaseYear}` : ""}, ${isShow ? "TV series" : "film"}`}
                    >
                      {item.posterUrl ? (
                        <Image
                          src={item.posterUrl}
                          alt=""
                          width={44}
                          height={66}
                          className="h-[66px] w-11 flex-shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-[66px] w-11 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-[10px] text-black-500">
                          No art
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-[15px] font-medium leading-snug text-white">{item.title}</h4>
                        <p className="mt-1 flex items-center gap-1.5 text-xs leading-none text-black-500">
                          <span>{isShow ? "Series" : "Film"}</span>
                          {item.releaseYear ? (
                            <>
                              <span aria-hidden>·</span>
                              <span>{item.releaseYear}</span>
                            </>
                          ) : null}
                          {rating ? (
                            <>
                              <span aria-hidden>·</span>
                              <span className="text-amber-400" aria-hidden>★</span>
                              <span>{rating}</span>
                            </>
                          ) : null}
                        </p>
                      </div>
                    </Link>
                    {canManageLists ? (
                      <button
                        type="button"
                        aria-label={savedListId ? `${item.title} is in a list` : `Add ${item.title} to a list`}
                        aria-controls={`add-to-list-${itemKey}`}
                        aria-expanded={activeItemKey === itemKey}
                        disabled={noLists}
                        onClick={() => {
                          if (noLists) return;
                          const isOpen = activeItemKey === itemKey;
                          setActiveItemKey(isOpen ? null : itemKey);
                          if (!isOpen) {
                            setSelectedListId(savedListId ?? selectedListId ?? lists[0]?.id ?? "");
                          }
                          setStatus(null);
                        }}
                        className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border transition disabled:opacity-30 ${FOCUS_CLASS} ${
                          savedListId
                            ? "border-white/15 bg-white/12 text-white"
                            : "border-white/12 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white hover:text-black"
                        }`}
                      >
                        {savedListId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </button>
                    ) : null}
                  </div>

                  {activeItemKey === itemKey && (
                    <div
                      id={`add-to-list-${itemKey}`}
                      className="mx-2 mb-1 mt-1 space-y-2 rounded-[18px] border border-white/10 bg-white/5 p-2.5"
                    >
                      {noLists ? (
                        <p className="text-sm text-black-400">Create a list first to save movies.</p>
                      ) : (
                        <>
                          <label className="sr-only" htmlFor={`list-picker-${itemKey}`}>
                            Select a list
                          </label>
                          <select
                            id={`list-picker-${itemKey}`}
                            value={selectedListId}
                            onChange={(event) => setSelectedListId(event.target.value)}
                            className="w-full rounded-full bg-black-900 px-3.5 py-2 text-sm text-black-100 outline-none"
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
                            onClick={() => handleAdd(item.tmdbId, mediaType)}
                            disabled={savingItemKey === itemKey || isInSelectedList(item.tmdbId, mediaType)}
                          >
                            {savingItemKey === itemKey
                              ? "Adding..."
                              : isInSelectedList(item.tmdbId, mediaType)
                                ? "Added"
                                : "Add to list"}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {status && status.itemKey === itemKey && (
                    <p
                      className={`mx-2 mb-1 text-xs ${status.tone === "success" ? "text-emerald-300" : "text-rose-300"}`}
                      role="status"
                    >
                      {status.message}
                    </p>
                  )}
                </li>
              );
            })}
            {isSearching && !displayItems.length && !error
              ? SKELETON_WIDTHS.map((width, index) => (
                  <li key={`placeholder-${index}`} className={ROW_CLASS} aria-hidden>
                    <div className="h-[66px] w-11 flex-shrink-0 animate-pulse rounded-lg bg-white/8" />
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className={`h-3.5 animate-pulse rounded-full bg-white/8 ${width}`} />
                      <div className="h-2.5 w-20 animate-pulse rounded-full bg-white/5" />
                    </div>
                  </li>
                ))
              : null}
            {error ? (
              <li>
                <p className="px-3 py-2.5 text-sm text-rose-300" role="alert" aria-live="assertive" id={errorId}>
                  {error}
                </p>
              </li>
            ) : null}
            {!displayItems.length && query.trim().length >= 2 && !isSearching && !error && (
              <li>
                <p className="px-3 py-2.5 text-sm text-black-500" role="status">
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
