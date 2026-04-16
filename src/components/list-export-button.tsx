"use client";

import { useState } from "react";
import { Download } from "@/components/icons";
import { apiFetch } from "@/lib/api-client";
import type { SimplifiedMovie } from "@/lib/tmdb";

type ListExportButtonProps = {
  tmdbIds: number[];
  ratingsMap: Record<number, number>;
  listSlug: string;
  listTitle: string;
};

export function ListExportButton({ tmdbIds, ratingsMap, listSlug, listTitle }: ListExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    if (isExporting || !tmdbIds.length) return;

    setIsExporting(true);
    try {
      const movies = await Promise.all(
        tmdbIds.map(async (tmdbId) => {
          const cached = readCachedMovie(tmdbId);
          if (cached) return cached;

          try {
            const result = await apiFetch<{ detail: SimplifiedMovie }>(`/tmdb/movie/${tmdbId}?lite=true`);
            if (result?.detail) {
              writeCachedMovie(result.detail);
              return result.detail;
            }
          } catch {
            // ignore export lookup failures
          }

          return null;
        }),
      );

      const rows = movies
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
        "Letterboxd Rating",
      ];

      const lines = [headers, ...rows]
        .map((row) =>
          row
            .map((value) => {
              const safe = value ?? "";
              const needsQuotes = /[",\n]/.test(safe);
              const escaped = safe.replace(/"/g, '""');
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
      disabled={isExporting || !tmdbIds.length}
      aria-label="Export CSV"
      title="Export CSV"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white transition hover:bg-black-800 active:bg-black-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className={`h-4 w-4 ${isExporting ? "animate-pulse" : ""}`} strokeWidth={2.25} />
    </button>
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

function slugifyForFilename(value: string) {
  const base = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  return base || "list";
}
