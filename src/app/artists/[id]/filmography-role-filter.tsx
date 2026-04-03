"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { FilmographyEntry } from "@/lib/tmdb";

type RoleOption = { key: string; label: string; count: number };

export function FilmographyRoleFilter({ filmography }: { filmography: FilmographyEntry[] }) {
  const roleOptions = useMemo(() => buildRoleOptions(filmography), [filmography]);
  const [selectedRole, setSelectedRole] = useState<string>("all");

  const filtered = useMemo(() => {
    if (selectedRole === "all") return filmography;
    return filmography.filter((credit) => roleKeyForCredit(credit) === selectedRole);
  }, [filmography, selectedRole]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.4em] text-black-500">Credits</p>
        {roleOptions.length > 1 ? (
          <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-black-500">
            <span>Role</span>
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
              className="rounded-full border border-black-700 bg-black-950 px-3 py-2 text-[11px] text-black-100"
              aria-label="Filter filmography by role"
            >
              <option value="all">All</option>
              {roleOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((credit) => (
            <Link
              key={`${credit.tmdbId}-${credit.role ?? "credit"}`}
              href={`/movies/${credit.tmdbId}`}
              className="flex gap-3 rounded-2xl bg-black-950 p-3 transition hover:bg-black-900"
            >
              {credit.posterUrl ? (
                <Image
                  src={credit.posterUrl}
                  alt={credit.title}
                  width={72}
                  height={108}
                  className="h-24 w-16 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-24 w-16 items-center justify-center rounded-xl bg-black-900 text-[10px] text-black-500">
                  No art
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm text-white">
                  {credit.title}
                  {credit.releaseYear ? <span className="text-xs text-black-500"> ({credit.releaseYear})</span> : null}
                </p>
                {credit.role ? <p className="text-xs text-black-500">{credit.role}</p> : null}
                {renderRatings(credit)}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-black-500">
          {selectedRole === "all" ? "No filmography found." : "No credits found for that role."}
        </p>
      )}
    </section>
  );
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
    if (a.key === "Acting") return -1;
    if (b.key === "Acting") return 1;
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
  return options;
}

function roleKeyForCredit(credit: FilmographyEntry): string {
  if (credit.creditType === "cast") return "Acting";
  const job = credit.job?.trim();
  if (job) return job;
  const department = credit.department?.trim();
  if (department) return department;
  const role = credit.role?.trim();
  if (role) return role;
  return "Other";
}

function roleLabelForKey(key: string): string {
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
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-black-300">
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-black-900 px-2 py-1 transition hover:-translate-y-0.5 hover:text-white"
        >
          <Image src={item.icon} alt={`${item.key} logo`} width={16} height={16} className="h-4 w-auto" />
          <span className="text-black-100">{item.value}</span>
        </a>
      ))}
    </div>
  );
}

