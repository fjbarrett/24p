"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import { getListColorStyles } from "@/lib/list-colors";
import { apiFetch } from "@/lib/api-client";
import type { SavedList } from "@/lib/list-store";
import type { SimplifiedMovie } from "@/lib/tmdb";

// How long each backdrop is visible before crossfading to the next one
const VISIBLE_MS = 5000;
// Duration of the crossfade between backdrops (and the initial fade-in)
const CROSSFADE_MS = 900;

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

// Two-layer state for A/B crossfade
type Layer = { url: string | null; on: boolean };

function ListCard({ list, showOwner }: ListCardProps) {
  // A and B layers sit on top of each other; we alternate which is "on"
  const [layerA, setLayerA] = useState<Layer>({ url: null, on: false });
  const [layerB, setLayerB] = useState<Layer>({ url: null, on: false });

  const mountedRef = useRef(true);
  const fetchedRef = useRef(false);
  const urlsRef = useRef<string[]>([]);
  const isHoveredRef = useRef(false);
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const activeLayerRef = useRef<"a" | "b">("a");
  // Ref that holds the latest scheduleCycle — lets the function call itself
  // without creating a circular useCallback dependency.
  const scheduleCycleRef = useRef<() => void>(() => {});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
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

  /** Crossfade to a new backdrop URL using the inactive A/B layer. */
  const crossfadeTo = useCallback((url: string) => {
    const next = activeLayerRef.current === "a" ? "b" : "a";

    // Paint the URL into the inactive (hidden) layer first
    if (next === "a") setLayerA({ url, on: false });
    else setLayerB({ url, on: false });

    // Double rAF: first frame applies the new URL, second triggers the
    // opacity transition so both layers animate simultaneously.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!mountedRef.current || !isHoveredRef.current) return;
        // Fade in the new layer, fade out the old one — true crossfade
        if (next === "a") {
          setLayerA((prev) => ({ ...prev, on: true }));
          setLayerB((prev) => ({ ...prev, on: false }));
        } else {
          setLayerB((prev) => ({ ...prev, on: true }));
          setLayerA((prev) => ({ ...prev, on: false }));
        }
        activeLayerRef.current = next;
        scheduleCycleRef.current();
      });
    });
  }, []);

  /** Wait VISIBLE_MS then pick a new backdrop and crossfade to it. */
  const scheduleCycle = useCallback(() => {
    if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
    cycleTimerRef.current = setTimeout(() => {
      if (!mountedRef.current || !isHoveredRef.current) return;
      const next = pickRandom(urlsRef.current, currentUrlRef.current);
      currentUrlRef.current = next;
      crossfadeTo(next);
    }, VISIBLE_MS);
  }, [crossfadeTo]);

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
    activeLayerRef.current = "a";

    // Load into layer A while hidden, then fade it in
    setLayerA({ url: first, on: false });
    setLayerB({ url: null, on: false });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!mountedRef.current || !isHoveredRef.current) return;
        setLayerA((prev) => ({ ...prev, on: true }));
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
    // Fade out whichever layer is currently showing
    setLayerA((prev) => ({ ...prev, on: false }));
    setLayerB((prev) => ({ ...prev, on: false }));
  }, []);

  const href = list.username ? `/${list.username}/${list.slug}` : null;
  const ownerHref = list.username ? `/${list.username}` : null;
  const colorStyles = getListColorStyles(list.color);

  return (
    <div className={!href ? "cursor-not-allowed" : undefined}>
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{ aspectRatio: "2.39 / 1", ...colorStyles.surface }}
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

        {/* Persistent color overlay — always visible beneath backdrops */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            ...colorStyles.overlay,
          }}
        />

        {/* A/B backdrop layers — crossfade by swapping opacity simultaneously */}
        {[layerA, layerB].map((layer, i) =>
          layer.url ? (
            <div
              key={i}
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 1,
                opacity: layer.on ? 1 : 0,
                transition: `opacity ${CROSSFADE_MS}ms ease-in-out`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${layer.url})`,
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
          ) : null,
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
