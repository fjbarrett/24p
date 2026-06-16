"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { FilmographyEntry } from "@/lib/tmdb";
import { toMovieSlug } from "@/lib/slug";

type RoleOption = { key: string; label: string; count: number };
type SortKey = "newest" | "rating";

export function FilmographyRoleFilter({ filmography }: { filmography: FilmographyEntry[] }) {
  const roleOptions = useMemo(() => buildRoleOptions(filmography), [filmography]);
  // Default to "all" but exclude self-appearances unless the user explicitly picks them
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const filtered = useMemo(() => {
    const base = selectedRole === "all"
      ? filmography.filter((credit) => !isSelfAppearance(credit))
      : filmography.filter((credit) => roleKeyForCredit(credit) === selectedRole);
    return base;
  }, [filmography, selectedRole]);

  // "newest" is the server's default order (release year desc), so leave it be.
  // "rating" re-ranks by a vote-weighted score so a handful of well-loved films
  // rise above obscure high-scores from a dozen votes.
  const sorted = useMemo(() => (sort === "rating" ? rankByRating(filtered) : filtered), [filtered, sort]);

  // Only worth offering a rating sort if some credits actually carry a score.
  const canSortByRating = useMemo(
    () => filmography.some((credit) => typeof credit.tmdbRating === "number"),
    [filmography],
  );

  return (
    <section className="space-y-4">
      {roleOptions.length > 1 || canSortByRating ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-white/50">{sorted.length} {sorted.length === 1 ? "credit" : "credits"}</span>
          <div className="flex items-center gap-2">
            {roleOptions.length > 1 ? (
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
                className="rounded-full bg-white/[0.06] px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10 focus:outline-none"
                aria-label="Filter filmography by role"
              >
                <option value="all">All roles</option>
                {roleOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            ) : null}
            {canSortByRating ? (
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="rounded-full bg-white/[0.06] px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10 focus:outline-none"
                aria-label="Sort filmography"
              >
                <option value="newest">Newest</option>
                <option value="rating">Top rated</option>
              </select>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-white/50">{sorted.length} {sorted.length === 1 ? "credit" : "credits"}</p>
      )}

      {sorted.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4 sm:gap-5">
          {sorted.map((credit) => (
            <li key={`${credit.tmdbId}-${credit.role ?? "credit"}`}>
              <FilmographyCard credit={credit} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-white/40">
          {selectedRole === "all" ? "No filmography found." : "No credits found for that role."}
        </p>
      )}
    </section>
  );
}

function isSelfAppearance(credit: FilmographyEntry): boolean {
  return credit.creditType === "cast" && (credit.role?.toLowerCase().startsWith("self") ?? false);
}

function buildRoleOptions(filmography: FilmographyEntry[]): RoleOption[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const credit of filmography) {
    const key = roleKeyForCredit(credit);
    const label = roleLabelForKey(key);
    const existing = counts.get(key);
    counts.set(key, { label, count: (existing?.count ?? 0) + 1 });
  }

  const options = Array.from(counts.entries()).map(([key, value]) => ({ key, label: value.label, count: value.count }));
  options.sort((a, b) => {
    // Self appearances always last
    if (a.key === "Appearances") return 1;
    if (b.key === "Appearances") return -1;
    if (a.key === "Acting") return -1;
    if (b.key === "Acting") return 1;
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
  return options;
}

function roleKeyForCredit(credit: FilmographyEntry): string {
  if (isSelfAppearance(credit)) return "Appearances";
  if (credit.creditType === "cast") return "Acting";
  const job = credit.job?.trim();
  if (job) return job;
  const department = credit.department?.trim();
  if (department) return department;
  return "Other";
}

function roleLabelForKey(key: string): string {
  if (key === "Appearances") return "Appearances";
  if (key === "Acting") return "Acting";
  if (key === "Other") return "Other";
  return key;
}

// Minimum TMDB votes for a film to be treated as "well-established" — also the
// pivot `m` in the Bayesian rank. Films below this still appear, but their score
// is pulled toward the set mean so they can't top the list on a few votes.
const VOTE_FLOOR = 50;
// Sparse / indie filmographies may have almost nothing above the main floor;
// fall back to this so "Top rated" doesn't collapse to a handful of titles.
const FALLBACK_FLOOR = 10;
const MIN_QUALIFYING = 5;

// IMDb Top 250-style Bayesian weighted rank: WR = (v/(v+m))·R + (m/(v+m))·C.
// Down-weights low-vote outliers toward the mean instead of hard-deleting them,
// so genuinely well-regarded films rise and obscure high-scores sink.
function rankByRating(credits: FilmographyEntry[]): FilmographyEntry[] {
  const rated = credits.filter(
    (c) => typeof c.tmdbRating === "number" && typeof c.voteCount === "number" && c.voteCount > 0,
  );
  const m =
    rated.filter((c) => (c.voteCount ?? 0) >= VOTE_FLOOR).length >= MIN_QUALIFYING ? VOTE_FLOOR : FALLBACK_FLOOR;
  const pool = rated.filter((c) => (c.voteCount ?? 0) >= m);
  const meanRating = pool.length ? pool.reduce((sum, c) => sum + (c.tmdbRating ?? 0), 0) / pool.length : 0;

  const score = (c: FilmographyEntry): number => {
    const v = c.voteCount ?? 0;
    if (typeof c.tmdbRating !== "number" || v < m) return -1; // below the floor / unrated → sink
    return (v / (v + m)) * c.tmdbRating + (m / (v + m)) * meanRating;
  };

  return [...credits].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    // Tie-break (incl. the sunk group): more votes, then popularity, then newer.
    const votes = (b.voteCount ?? 0) - (a.voteCount ?? 0);
    if (votes !== 0) return votes;
    const pop = (b.popularity ?? 0) - (a.popularity ?? 0);
    if (pop !== 0) return pop;
    return (b.releaseYear ?? 0) - (a.releaseYear ?? 0);
  });
}

// Poster-grid card that mirrors the streaming-availability layout
// (StreamingCatalogCard): a 2:3 poster with a hover inset glow, a bottom
// gradient, and the rating pinned to the bottom-right.
function FilmographyCard({ credit }: { credit: FilmographyEntry }) {
  const href = `/movies/${toMovieSlug(credit.title, credit.releaseYear)}`;
  const label = credit.releaseYear ? `${credit.title} (${credit.releaseYear})` : credit.title;

  return (
    <div className="group relative aspect-[2/3] w-full rounded-lg focus-within:ring-2 focus-within:ring-white/70 focus-within:ring-offset-2 focus-within:ring-offset-black">
      {/* overflow-hidden lives on this inner div so the focus ring isn't clipped */}
      <div className="absolute inset-0 overflow-hidden rounded-lg bg-neutral-900">
        {credit.posterUrl ? (
          <Image
            src={credit.posterUrl}
            alt={`${credit.title} poster`}
            fill
            sizes="(max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] leading-tight text-white/40">
            {label}
          </div>
        )}
      </div>
      <Link href={href} className="absolute inset-0 z-10 rounded-lg" aria-label={label} />
      <div className="pointer-events-none absolute inset-0 z-10 rounded-lg shadow-[inset_0_0_20px_rgba(0,0,0,0.55)] transition-shadow duration-300 group-hover:shadow-[inset_0_0_20px_rgba(255,255,255,0.06)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
      {renderRatingBadge(credit)}
    </div>
  );
}

function renderRatingBadge(credit: FilmographyEntry) {
  // Prefer a real IMDb rating when one is present; otherwise show the TMDB
  // community score, which is always available from movie_credits.
  if (typeof credit.imdbRating === "number" && credit.imdbId) {
    return (
      <a
        href={`https://www.imdb.com/title/${credit.imdbId}/`}
        target="_blank"
        rel="noreferrer"
        aria-label={`${credit.title} on IMDb — ${credit.imdbRating.toFixed(1)}`}
        className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1 rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <Image src="/imdb_logo.svg" alt="IMDb" width={28} height={14} className="h-3.5 w-auto" unoptimized />
        <span className="text-[11px] font-medium text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
          {credit.imdbRating.toFixed(1)}
        </span>
      </a>
    );
  }

  if (typeof credit.tmdbRating !== "number") return null;

  return (
    <div className="pointer-events-none absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1">
      <span className="text-[11px] leading-none text-amber-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]" aria-hidden>
        ★
      </span>
      <span className="text-[11px] font-medium text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
        {credit.tmdbRating.toFixed(1)}
      </span>
    </div>
  );
}

