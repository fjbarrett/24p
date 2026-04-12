"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import type { SavedList } from "@/lib/list-store";
import type { SimplifiedMovie } from "@/lib/tmdb";

// Poster dimensions and layout
const POSTER_W = 56;
const POSTER_H = 84;
const POSTER_STRIDE = 40; // horizontal offset per poster (creates ~16px overlap)
const POSTER_BOTTOM = 12;
const POSTER_LEFT_OFFSET = 16;
const MAX_POSTERS = 5;

// Three phases: posters waiting off-right → visible (snap in) → flying off-left
type Phase = "idle-right" | "visible" | "idle-left";

type ListCardProps = {
  list: SavedList;
  showOwner?: boolean;
};

function ListCard({ list, showOwner }: ListCardProps) {
  const [phase, setPhase] = useState<Phase>("idle-right");
  const [posterUrls, setPosterUrls] = useState<string[]>([]);
  const fetchedRef = useRef(false);
  const mountedRef = useRef(true);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  const fetchPosters = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const items = list.items.slice(0, MAX_POSTERS);
    const urls: string[] = [];

    for (const item of items) {
      // Prefer sessionStorage cache (shared with ListMoviesGrid)
      const cached =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(`tmdb:${item.tmdbId}`)
          : null;

      if (cached) {
        try {
          const movie = JSON.parse(cached) as SimplifiedMovie;
          if (movie.posterUrl) {
            urls.push(movie.posterUrl);
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
        if (result?.detail?.posterUrl) {
          urls.push(result.detail.posterUrl);
          try {
            window.sessionStorage.setItem(
              `tmdb:${item.tmdbId}`,
              JSON.stringify(result.detail),
            );
          } catch {
            // ignore
          }
        }
      } catch {
        // individual fetch failures are silently skipped
      }
    }

    if (mountedRef.current && urls.length > 0) {
      setPosterUrls(urls);
    }
  }, [list.items]);

  const handleMouseEnter = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    fetchPosters();
    setPhase("visible");
  }, [fetchPosters]);

  const handleMouseLeave = useCallback(() => {
    setPhase("idle-left");
    // After the exit animation completes, reset to idle-right (instant, no transition)
    // so the next hover always enters from the right.
    leaveTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setPhase("idle-right");
    }, 320);
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

        {/* Poster strip — flies in from right on hover, exits left on leave */}
        {posterUrls.length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-10">
            {posterUrls.map((url, i) => {
              const leftPx = POSTER_LEFT_OFFSET + i * POSTER_STRIDE;

              let transform: string;
              let duration: string;
              let easing: string;
              let delay: string;

              if (phase === "visible") {
                // Snap in from right with spring overshoot
                transform = "translateX(0)";
                duration = "380ms";
                easing = "cubic-bezier(0.22, 1.42, 0.36, 1)";
                delay = `${i * 55}ms`;
              } else if (phase === "idle-left") {
                // All fly left together — natural visual stagger as rightmost
                // posters take longer to cross the card boundary
                transform = "translateX(-420px)";
                duration = "240ms";
                easing = "cubic-bezier(0.4, 0, 0.8, 0.2)";
                delay = "0ms";
              } else {
                // idle-right: instant reset, no animation
                transform = `translateX(500px)`;
                duration = "0ms";
                easing = "linear";
                delay = "0ms";
              }

              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${leftPx}px`,
                    bottom: `${POSTER_BOTTOM}px`,
                    width: `${POSTER_W}px`,
                    height: `${POSTER_H}px`,
                    borderRadius: "4px",
                    overflow: "hidden",
                    transform,
                    transition: `transform ${duration} ${easing} ${delay}`,
                    boxShadow: "2px 6px 20px rgba(0,0,0,0.75)",
                    willChange: "transform",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Text content */}
        <div className="relative z-0 flex h-full flex-col justify-end p-4">
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
