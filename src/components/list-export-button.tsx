"use client";

import { useState } from "react";
import { Download } from "@/components/icons";
import { apiFetch } from "@/lib/api-client";
import type { ListItem } from "@/lib/list-store";
import type { SimplifiedMovie } from "@/lib/tmdb";

type ListExportButtonProps = {
  items: ListItem[];
  ratingsMap: Record<number, number>;
  listSlug: string;
  listTitle: string;
};

// Movie and TV ids overlap; the cache key scheme matches list-movies-grid.
function titleCacheKey(tmdbId: number, mediaType?: string) {
  return `tmdb:${mediaType === "tv" ? "tv" : "movie"}:${tmdbId}`;
}

export function ListExportButton({ items, ratingsMap, listSlug, listTitle }: ListExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    if (isExporting || !items.length) return;

    setIsExporting(true);
    try {
      const resolved = new Map<string, SimplifiedMovie>();
      const missing: ListItem[] = [];
      items.forEach((item) => {
        const cached = readCachedTitle(item);
        if (cached) resolved.set(titleCacheKey(item.tmdbId, item.mediaType), cached);
        else missing.push(item);
      });

      // Resolve stragglers through the batch endpoint (it handles TV ids and
      // caps at 50 ids per request) instead of one movie-only call per title,
      // which dropped every TV row and could blow the per-IP detail budget.
      const BATCH_SIZE = 50;
      for (let start = 0; start < missing.length; start += BATCH_SIZE) {
        const batch = missing.slice(start, start + BATCH_SIZE);
        const movieIds = batch.filter((item) => item.mediaType !== "tv").map((item) => item.tmdbId);
        const tvIds = batch.filter((item) => item.mediaType === "tv").map((item) => item.tmdbId);
        const query = new URLSearchParams();
        if (movieIds.length) query.set("movies", movieIds.join(","));
        if (tvIds.length) query.set("tv", tvIds.join(","));
        try {
          const result = await apiFetch<{ titles: SimplifiedMovie[] }>(`/tmdb/titles?${query.toString()}`);
          for (const title of result?.titles ?? []) {
            resolved.set(titleCacheKey(title.tmdbId, title.mediaType), title);
            writeCachedTitle(title);
          }
        } catch {
          // ignore export lookup failures
        }
      }

      const rows = items
        .map((item) => resolved.get(titleCacheKey(item.tmdbId, item.mediaType)))
        .filter((movie): movie is SimplifiedMovie => Boolean(movie))
        .map((movie) => {
          const userRating = ratingsMap[movie.tmdbId];
          return [
            listTitle,
            movie.title,
            movie.tmdbId.toString(),
            movie.releaseYear ? movie.releaseYear.toString() : "",
            typeof userRating === "number" ? userRating.toString() : "",
            typeof movie.rating === "number" ? movie.rating.toFixed(1) : "",
            typeof movie.imdbRating === "number" ? movie.imdbRating.toFixed(1) : "",
            movie.mediaType === "tv" ? "tv" : "movie",
          ];
        });

      if (!rows.length) return;

      const headers = [
        "List Name",
        "Movie Title",
        "TMDB ID",
        "Release Year",
        "Your Rating",
        "TMDB Rating",
        "IMDb Rating",
        "Media Type",
      ];

      const lines = [headers, ...rows]
        .map((row) =>
          row
            .map((value) => {
              const safe = value ?? "";
              // Defeat spreadsheet formula injection: cells starting with =, +,
              // -, @, tab, or CR are interpreted as formulas by Excel/Numbers/
              // Sheets. Prefix with a leading apostrophe to render literally.
              const neutralized = /^[=+\-@\t\r]/.test(safe) ? `'${safe}` : safe;
              const needsQuotes = /[",\n]/.test(neutralized);
              const escaped = neutralized.replace(/"/g, '""');
              return needsQuotes ? `"${escaped}"` : escaped;
            })
            .join(","),
        )
        .join("\n");

      const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = `${slugifyForFilename(listSlug || listTitle)}-export.csv`;
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting || !items.length}
      aria-label="Export CSV"
      title="Export CSV"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white transition hover:bg-black-800 active:bg-black-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className={`h-4 w-4 ${isExporting ? "animate-pulse" : ""}`} strokeWidth={2.25} />
    </button>
  );
}

function readCachedTitle(item: ListItem) {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(titleCacheKey(item.tmdbId, item.mediaType));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SimplifiedMovie;
  } catch {
    return null;
  }
}

function writeCachedTitle(movie: SimplifiedMovie) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(titleCacheKey(movie.tmdbId, movie.mediaType), JSON.stringify(movie));
  } catch {
    // ignore cache write errors
  }
}

function slugifyForFilename(value: string) {
  const base = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  return base || "list";
}
