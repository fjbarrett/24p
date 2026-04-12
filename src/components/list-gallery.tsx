"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import type { SavedList } from "@/lib/list-store";
import type { SimplifiedMovie } from "@/lib/tmdb";

// How long the backdrop is visible before cycling to the next one
const VISIBLE_MS = 5000;
// Fade durations
const FADE_IN_MS = 1200;
const FADE_OUT_MS = 700;
// Brief pause at black between images
const BLACK_PAUSE_MS = 150;

/** Swap any TMDB image size to w300 — fast enough for a darkened card bg */
function toCardBackdrop(url: string): string {
  return url.replace(/\/t\/p\/\w+\//, "/t/p/w300/");
}

function pickRandom(urls: string[], exclude?: string | null): string {
  const pool = urls.length > 1 ? urls.filter((u) => u !== exclude) : urls;
  return pool[Math.floor(Math.random() * pool.length)];
}

type ListCardProps = {
  list: SavedList;
  showOwner?: boolean;
};

function ListCard({ list, showOwner }: ListCardProps) {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const mountedRef = useRef(true);
  const fetchedRef = useRef(false);
  const urlsRef = useRef<string[]>([]);
  const isHoveredRef = useRef(false);
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  // Ref that holds the latest scheduleCycle — lets the function call itself
  // without creating a circular useCallback dependency.
  const scheduleCycleRef = useRef<() => void>(() => {});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  const fetchBackdrops = useCallback(async (): Promise<string[]> => {
    if (fetchedRef.current) return urlsRef.current;
    fetchedRef.current = true;

    const items = list.items.slice(0, 12); // look at up to 12 films for variety
    const urls: string[] = [];

    for (const item of items) {
      const cached =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(`tmdb:${item.tmdbId}`)
          : null;

      if (cached) {
        try {
          const movie = JSON.parse(cached) as SimplifiedMovie;
          if (movie.backdropUrl) {
            urls.push(toCardBackdrop(movie.backdropUrl));
            continue;
          }
        } catch {
          // fall through
        }
      }

      try {
        const isShow = item.mediaType === "tv";
        const endpoint = isShow
          ? `/tmdb/tv/${item.tmdbId}`
          : `/tmdb/movie/${item.tmdbId}?lite=true`;
        const result = await apiFetch<{ detail: SimplifiedMovie }>(endpoint);
        if (result?.detail) {
          try {
            window.sessionStorage.setItem(
              `tmdb:${item.tmdbId}`,
              JSON.stringify(result.detail),
            );
          } catch {
            // ignore quota errors
          }
          if (result.detail.backdropUrl) {
            urls.push(toCardBackdrop(result.detail.backdropUrl));
          }
        }
      } catch {
        // silently skip individual failures
      }
    }

    urlsRef.current = urls;

    // Kick off preloading in the background so subsequent crossfades are instant
    if (typeof window !== "undefined") {
      for (const url of urls) {
        const img = new window.Image();
        img.src = url;
      }
    }

    return urls;
  }, [list.items]);

  /** Schedule the next fade-out → swap → fade-in cycle */
  const scheduleCycle = useCallback(() => {
    if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);

    cycleTimerRef.current = setTimeout(() => {
      if (!mountedRef.current || !isHoveredRef.current) return;

      // Fade out
      setIsVisible(false);

      fadeTimerRef.current = setTimeout(() => {
        if (!mountedRef.current || !isHoveredRef.current) return;

        // Pick a new backdrop (not the same one) while invisible
        const next = pickRandom(urlsRef.current, currentUrlRef.current);
        currentUrlRef.current = next;
        setActiveUrl(next);

        // One rAF to let the DOM paint the new src, then trigger fade-in
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!mountedRef.current || !isHoveredRef.current) return;
            setIsVisible(true);
            // Call through ref to avoid circular useCallback dependency
            scheduleCycleRef.current();
          });
        });
      }, FADE_OUT_MS + BLACK_PAUSE_MS);
    }, VISIBLE_MS);
  }, []);

  // Keep the ref in sync so the recursive call always uses the latest closure
  useEffect(() => {
    scheduleCycleRef.current = scheduleCycle;
  }, [scheduleCycle]);

  const handleMouseEnter = useCallback(async () => {
    isHoveredRef.current = true;

    const urls = await fetchBackdrops();
    if (!urls.length || !mountedRef.current || !isHoveredRef.current) return;

    const first = pickRandom(urls);
    currentUrlRef.current = first;
    setActiveUrl(first);

    // Double rAF: first frame sets the src, second frame starts the transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!mountedRef.current || !isHoveredRef.current) return;
        setIsVisible(true);
        scheduleCycle();
      });
    });
  }, [fetchBackdrops, scheduleCycle]);

  const handleMouseLeave = useCallback(() => {
    isHoveredRef.current = false;
    if (cycleTimerRef.current) {
      clearTimeout(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setIsVisible(false);
  }, []);

  const href = list.username ? `/${list.username}/${list.slug}` : null;
  const ownerHref = list.username ? `/${list.username}` : null;

  return (
    <div className={!href ? "cursor-not-allowed" : undefined}>
      <div
        className="relative overflow-hidden rounded-2xl bg-neutral-900"
        style={{ aspectRatio: "2.39 / 1" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {href && (
          <Link
            href={href}
            className="absolute inset-0 z-20"
            aria-label={list.title}
          />
        )}

        {/* Backdrop — fades in/out over the dark card background */}
        {activeUrl && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              opacity: isVisible ? 1 : 0,
              transition: isVisible
                ? `opacity ${FADE_IN_MS}ms ease-in`
                : `opacity ${FADE_OUT_MS}ms ease-out`,
            }}
          >
            {/* The film still */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${activeUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center 30%",
              }}
            />
            {/* Gradient darkens the image so title text stays legible */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to bottom, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.72) 100%)",
              }}
            />
          </div>
        )}

        {/* Text content */}
        <div className="relative z-10 flex h-full flex-col justify-end p-4">
          {showOwner && list.username && ownerHref ? (
            <Link
              href={ownerHref}
              className="relative z-20 mb-1 self-start text-[11px] uppercase tracking-[0.4em] text-white/40 hover:text-white"
            >
              @{list.username}
            </Link>
          ) : null}
          <h3 className="text-xl font-semibold text-white">{list.title}</h3>
          {typeof list.movies?.length === "number" && (
            <p className="mt-0.5 text-xs text-white/50">
              {list.movies.length}{" "}
              {list.movies.length === 1 ? "film" : "films"}
            </p>
          )}
          {!href && (
            <p className="mt-0.5 text-xs text-white/40">
              Set a username to share this list.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type ListGalleryProps = {
  lists: SavedList[];
  title?: string;
  emptyMessage?: string;
  id?: string;
  showOwner?: boolean;
  viewerEmail?: string;
};

export function ListGallery({
  lists,
  title = "Lists",
  emptyMessage,
  id = "lists",
  showOwner = false,
}: ListGalleryProps) {
  if (!lists.length) {
    return (
      <section
        id={id}
        className="rounded-3xl border border-white/10 bg-black-900/40 p-6 text-center"
      >
        {title ? (
          <p className="text-xs uppercase tracking-[0.4em] text-black-400">
            {title}
          </p>
        ) : null}
        <p className={`${title ? "mt-2 " : ""}text-sm text-black-500`}>
          {emptyMessage ??
            "No lists yet. Use the buttons below to create or import your first one."}
        </p>
      </section>
    );
  }

  return (
    <section id={id} className="space-y-4">
      {title ? (
        <p className="text-xs uppercase tracking-[0.4em] text-black-400">
          {title}
        </p>
      ) : null}
      <div className="grid gap-6 sm:grid-cols-2">
        {lists.map((list) => (
          <ListCard key={list.id} list={list} showOwner={showOwner} />
        ))}
      </div>
    </section>
  );
}
