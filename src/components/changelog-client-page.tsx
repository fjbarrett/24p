"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import type { ChangelogEntry } from "@/lib/changelog";

type FilterValue = "All" | "Release" | "Improvement" | "Retired";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function monthKey(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
  const day = new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(date);
  return `${month}.${day}`;
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

export function ChangelogClientPage({ entries }: { entries: ChangelogEntry[] }) {
  const [activeFilter, setActiveFilter] = useState<FilterValue>("All");

  const filteredEntries = useMemo(() => {
    if (activeFilter === "All") return entries;
    return entries.filter((entry) => entry.type === activeFilter);
  }, [activeFilter, entries]);

  const months = useMemo(
    () =>
      filteredEntries.reduce<Array<{ label: string; entries: ChangelogEntry[] }>>((groups, entry) => {
        const label = monthKey(entry.date);
        const current = groups.at(-1);

        if (current?.label === label) {
          current.entries.push(entry);
          return groups;
        }

        groups.push({ label, entries: [entry] });
        return groups;
      }, []),
    [filteredEntries],
  );

  return (
    <main className="px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
      <div className="mx-auto w-full max-w-[980px]">
        <div className="mb-6 max-w-[760px]">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.1} />
            Back to 24p
          </Link>
        </div>

        <div className="border-t border-white/10" />

        <div className="mx-auto max-w-[760px] pt-8 sm:pt-12">
          <header className="text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Changelog</h1>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-white/52">
              <span>Latest changes across 24p</span>
              <span className="hidden h-4 w-px bg-white/12 sm:block" />
              <span>{filteredEntries.length} matching updates</span>
            </div>
          </header>

          <div className="my-8 border-t border-white/10" />

          <section className="mb-8 flex flex-wrap gap-3">
            <FilterChip active={activeFilter === "All"} onClick={() => setActiveFilter("All")}>
              All
            </FilterChip>
            <FilterChip active={activeFilter === "Release"} onClick={() => setActiveFilter("Release")}>
              New releases
            </FilterChip>
            <FilterChip active={activeFilter === "Improvement"} onClick={() => setActiveFilter("Improvement")}>
              Improvements
            </FilterChip>
            <FilterChip active={activeFilter === "Retired"} onClick={() => setActiveFilter("Retired")}>
              Retired
            </FilterChip>
          </section>

          {months.length ? (
            <div className="space-y-8">
              {months.map((month, index) => (
                <details
                  key={month.label}
                  open={index === 0}
                  className="group"
                >
                  <summary className="flex list-none items-center justify-between gap-4 border-b border-white/10 pb-4 text-left marker:content-none">
                    <span className="text-2xl font-semibold tracking-tight text-white">{month.label}</span>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/65 transition group-open:rotate-180">
                      <ChevronDown className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                  </summary>

                  <div className="space-y-0">
                    {month.entries.map((entry) => (
                      <article key={entry.slug} className="border-b border-white/8 py-6 last:border-b-0">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                          <div className="flex min-w-[128px] items-center gap-2 text-sm text-white/58">
                            <span className="inline-flex rounded-full border border-white/10 px-2 py-1 font-mono text-[12px] uppercase tracking-[0.16em] text-white/72">
                              {shortDate(entry.date)}
                            </span>
                            <span
                              className={`inline-flex rounded-full border px-2 py-1 text-[12px] uppercase tracking-[0.14em] ${typePillClassName(entry.type)}`}
                            >
                              {entry.type}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-semibold leading-7 tracking-tight text-white">
                              {entry.title}
                            </h2>
                            <p className="mt-2 max-w-[620px] text-sm leading-7 text-white/65">
                              {entry.summary}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {entry.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[12px] text-white/52"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>

                            <div className="mt-5 space-y-4">
                              <ChangeGroup label="Added" items={entry.added} />
                              <ChangeGroup label="Changed" items={entry.changed} />
                              <ChangeGroup label="Removed" items={entry.removed} />
                              <p className="pt-1 text-xs text-white/36">{formatDate(entry.date)}</p>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 px-5 py-8 text-center text-sm text-white/58">
              No changelog items match that filter yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function typePillClassName(type: ChangelogEntry["type"]) {
  switch (type) {
    case "Release":
      return "border-green-500/35 bg-green-500/12 text-green-200";
    case "Improvement":
      return "border-yellow-500/35 bg-yellow-500/12 text-yellow-200";
    case "Retired":
      return "border-red-500/35 bg-red-500/12 text-red-200";
  }
}

function FilterChip({
  children,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition cursor-pointer ${
        active
          ? "border-white/16 bg-white/10 text-white"
          : "border-white/10 bg-transparent text-white/62 hover:border-white/16 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ChangeGroup({ label, items }: { label: string; items: string[] | undefined }) {
  if (!items?.length) {
    return null;
  }

  return (
    <section>
      <h3 className="text-[11px] uppercase tracking-[0.24em] text-white/40">{label}</h3>
      <ul className="mt-3 space-y-3 text-sm leading-7 text-white/72">
        {items.map((item) => (
          <li key={item} className="border-l border-white/10 pl-4">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
