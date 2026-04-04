"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SavedList } from "@/lib/list-store";
import { rustApiFetch } from "@/lib/rust-api-client";
import type { SimplifiedMovie } from "@/lib/tmdb";

const MOSAIC_LIMIT = 4;

type ListGalleryProps = {
  lists: SavedList[];
  title?: string;
  emptyMessage?: string;
  id?: string;
  showOwner?: boolean;
};

export function ListGallery({ lists, title = "Lists", emptyMessage, id = "lists", showOwner = false }: ListGalleryProps) {
  if (!lists.length) {
    return (
      <section id={id} className="rounded-3xl border border-white/10 bg-black-900/40 p-6 text-center">
        {title ? <p className="text-xs uppercase tracking-[0.4em] text-black-400">{title}</p> : null}
        <p className={`${title ? "mt-2 " : ""}text-sm text-black-500`}>
          {emptyMessage ?? "No lists yet. Use the buttons below to create or import your first one."}
        </p>
      </section>
    );
  }

  return (
    <section id={id} className="space-y-4">
      {title ? <p className="text-xs uppercase tracking-[0.4em] text-black-400">{title}</p> : null}
      <div className="grid gap-6 sm:grid-cols-2">
        {lists.map((list) => {
          const href = list.username ? `/${list.username}/${list.slug}` : null;
          const ownerHref = list.username ? `/${list.username}` : null;
          const card = (
            <div
              className="group relative block h-40 overflow-hidden rounded-2xl border border-black-800 bg-black-950"
            >
              {href && <Link href={href} className="absolute inset-0 z-10" aria-label={list.title} />}
              <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black-950">
                <ListPosterMosaic tmdbIds={list.movies} title={list.title} />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black-900/25 via-black-950/50 to-black-950" />
                <div className="relative z-0 flex h-full flex-col justify-end p-4">
                  {showOwner && list.username && ownerHref ? (
                    <Link
                      href={ownerHref}
                      className="relative z-20 text-[11px] uppercase tracking-[0.4em] text-black-400 hover:text-white"
                    >
                      @{list.username}
                    </Link>
                  ) : null}
                  <h3 className="text-xl font-semibold text-white">{list.title}</h3>
                  {typeof list.movies?.length === "number" && (
                    <p className="mt-1 text-xs text-black-500">
                      {list.movies.length} {list.movies.length === 1 ? "film" : "films"}
                    </p>
                  )}
                  {!href && <p className="text-xs text-black-500">Set a username to share this list.</p>}
                </div>
              </div>
            </div>
          );
          if (!href) {
            return (
              <div key={list.id} className="cursor-not-allowed">
                {card}
              </div>
            );
          }
          return (
            <div key={list.id}>
              {card}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ListPosterMosaic({ tmdbIds, title }: { tmdbIds: number[]; title: string }) {
  const [posters, setPosters] = useState<(string | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    const ids = tmdbIds.slice(0, MOSAIC_LIMIT);

    if (!ids.length) {
      Promise.resolve().then(() => {
        if (!cancelled) {
          setPosters([]);
        }
      });
      return;
    }

    async function load() {
      const next = await Promise.all(
        ids.map(async (tmdbId) => {
          const cached = readCachedMovie(tmdbId);
          if (cached?.posterUrl) {
            return toSmallPoster(cached.posterUrl);
          }

          try {
            const result = await rustApiFetch<{ detail: SimplifiedMovie }>(`/tmdb/movie/${tmdbId}?lite=true`);
            if (result?.detail) {
              writeCachedMovie(result.detail);
              return result.detail.posterUrl ? toSmallPoster(result.detail.posterUrl) : null;
            }
          } catch {
            // ignore poster lookup failures
          }

          return null;
        }),
      );

      if (!cancelled) {
        setPosters(next);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [tmdbIds]);

  if (!posters.length) {
    return (
      <div className="absolute inset-x-0 top-0 flex h-[92px] items-start justify-start gap-0 px-4 pt-4" aria-hidden>
        {Array.from({ length: MOSAIC_LIMIT }).map((_, index) => (
          <div
            key={index}
            className={`h-[76px] w-[52px] rounded-[10px] bg-black-900/90 ${index > 0 ? "-ml-2" : ""}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 top-0 flex h-[92px] items-start justify-start gap-0 px-4 pt-4" aria-hidden>
      {Array.from({ length: MOSAIC_LIMIT }).map((_, index) => {
        const posterUrl = posters[index];

        if (!posterUrl) {
          return (
            <div
              key={`${title}-${index}`}
              className={`h-[76px] w-[52px] rounded-[10px] bg-black-900/90 ${index > 0 ? "-ml-2" : ""}`}
            />
          );
        }

        return (
          <div
            key={`${title}-${index}`}
            className={`relative h-[76px] w-[52px] overflow-hidden rounded-[10px] bg-black-900/90 shadow-lg ${index > 0 ? "-ml-2" : ""}`}
          >
            <Image
              src={posterUrl}
              alt=""
              fill
              sizes="52px"
              className="object-cover opacity-95"
            />
          </div>
        );
      })}
    </div>
  );
}

function readCachedMovie(tmdbId: number) {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(`tmdb:${tmdbId}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SimplifiedMovie;
  } catch {
    return null;
  }
}

function writeCachedMovie(movie: SimplifiedMovie) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(`tmdb:${movie.tmdbId}`, JSON.stringify(movie));
  } catch {
    // ignore cache write errors
  }
}

function toSmallPoster(url: string) {
  return url.includes("/w500/")
    ? url.replace("/w500/", "/w185/")
    : url.includes("/w342/")
      ? url.replace("/w342/", "/w185/")
      : url;
}
