"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { FilmographyEntry } from "@/lib/tmdb";

type RoleOption = { key: string; label: string; count: number };

export function FilmographyRoleFilter({ filmography }: { filmography: FilmographyEntry[] }) {
  const roleOptions = useMemo(() => buildRoleOptions(filmography), [filmography]);
  // Default to "all" but exclude self-appearances unless the user explicitly picks them
  const [selectedRole, setSelectedRole] = useState<string>("all");

  const filtered = useMemo(() => {
    const base = selectedRole === "all"
      ? filmography.filter((credit) => !isSelfAppearance(credit))
      : filmography.filter((credit) => roleKeyForCredit(credit) === selectedRole);
    return base;
  }, [filmography, selectedRole]);

  return (
    <section className="space-y-4">
      {roleOptions.length > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-white/50">{filtered.length} {filtered.length === 1 ? "credit" : "credits"}</span>
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
        </div>
      ) : (
        <p className="text-sm text-white/50">{filtered.length} {filtered.length === 1 ? "credit" : "credits"}</p>
      )}

      {filtered.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((credit) => (
            <Link
              key={`${credit.tmdbId}-${credit.role ?? "credit"}`}
              href={`/movies/${credit.tmdbId}`}
              className="flex gap-3 rounded-2xl bg-white/[0.04] p-3 transition hover:bg-white/[0.08]"
            >
              {credit.posterUrl ? (
                <Image
                  src={credit.posterUrl}
                  alt={credit.title}
                  width={72}
                  height={108}
                  className="h-24 w-16 flex-shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-24 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[10px] text-white/30">
                  No art
                </div>
              )}
              <div className="flex-1 space-y-1 pt-0.5">
                <p className="text-sm font-medium text-white leading-snug">
                  {credit.title}
                  {credit.releaseYear ? <span className="ml-1.5 text-xs font-normal text-white/40">({credit.releaseYear})</span> : null}
                </p>
                {credit.role ? <p className="text-xs text-white/50">{credit.role}</p> : null}
                {renderRatings(credit)}
              </div>
            </Link>
          ))}
        </div>
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

function renderRatings(credit: FilmographyEntry) {
  const items: { key: string; href: string; value: string; icon: string }[] = [];

  if (typeof credit.imdbRating === "number" && credit.imdbId) {
    items.push({
      key: "imdb",
      href: `https://www.imdb.com/title/${credit.imdbId}/`,
      value: credit.imdbRating.toFixed(1),
      icon: "/imdb_logo.svg",
    });
  }

  if (!items.length) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1 transition hover:bg-white/10 hover:text-white"
        >
          <Image src={item.icon} alt={`${item.key} logo`} width={16} height={16} className="h-4 w-auto" />
          <span className="text-white/70">{item.value}</span>
        </a>
      ))}
    </div>
  );
}

