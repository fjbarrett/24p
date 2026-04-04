"use client";

import { Search } from "lucide-react";

// ── Shared mock data ──────────────────────────────────────────────────────────

const ACCENT_COLORS = ["#e864c6", "#8c63e0", "#3d7fcf", "#54c295", "#d8a534", "#e68630", "#e05555"];

function pickAccent(key: string) {
  return ACCENT_COLORS[
    Array.from(key).reduce((s, c) => (s * 31 + c.charCodeAt(0)) % ACCENT_COLORS.length, 0)
  ];
}

const MOCK_LISTS = [
  { id: "1", slug: "best-films",   title: "Best Films",          movies: new Array(8),  username: "frank" },
  { id: "2", slug: "directors-cut",title: "Director's Cut",      movies: new Array(2),  username: "frank" },
  { id: "3", slug: "to-watch",     title: "To Watch",            movies: [],            username: "frank" },
  { id: "4", slug: "criterion",    title: "Criterion Favorites", movies: new Array(14), username: "frank" },
];

// ── Diff label ────────────────────────────────────────────────────────────────

function DiffLabel({ label, file }: { label: string; file: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.4em] text-neutral-500">{file}</p>
      <h2 className="text-base font-semibold text-white">{label}</h2>
    </div>
  );
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 min-w-0">
      <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-600">{label}</p>
      {children}
    </div>
  );
}

// ── Change 1 — List gallery: hover + movie count ──────────────────────────────

function ListCardBefore({ list }: { list: (typeof MOCK_LISTS)[0] }) {
  const accent = pickAccent(list.slug);
  return (
    <div className="group relative block h-40 overflow-hidden rounded-2xl border border-black-800 bg-black-950">
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black-950">
        <div className="absolute inset-x-4 top-4 h-[3px] rounded-full opacity-70" style={{ background: accent }} aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black-900 via-black-950 to-black-950" />
        <div className="relative z-0 flex h-full flex-col justify-end p-4">
          <p className="text-[11px] uppercase tracking-[0.4em] text-black-400">@{list.username}</p>
          <h3 className="text-xl font-semibold text-white">{list.title}</h3>
        </div>
      </div>
    </div>
  );
}

function ListCardAfter({ list }: { list: (typeof MOCK_LISTS)[0] }) {
  const accent = pickAccent(list.slug);
  return (
    <div className="group relative block h-40 overflow-hidden rounded-2xl border border-black-800 bg-black-950">
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black-950">
        <div className="absolute inset-x-4 top-4 h-[3px] rounded-full opacity-70" style={{ background: accent }} aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black-900 via-black-950 to-black-950" />
        <div className="relative z-0 flex h-full flex-col justify-end p-4">
          <p className="text-[11px] uppercase tracking-[0.4em] text-black-400">@{list.username}</p>
          <h3 className="text-xl font-semibold text-white">{list.title}</h3>
          <p className="mt-1 text-xs text-black-500">
            {list.movies.length} {list.movies.length === 1 ? "film" : "films"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Change 2 — List editor: slate-* → black-* ─────────────────────────────────

function ListEditorBefore() {
  return (
    <div className="space-y-3 rounded-2xl border border-black-800 bg-black-950/50 p-4">
      <input defaultValue="Best Films" readOnly
        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
      <input defaultValue="best-films" readOnly
        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
      <div className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
        <label className="flex items-center justify-between gap-4">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Visibility</span>
          <select className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-100">
            <option>Private</option>
            <option>Public</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">Save changes</button>
        <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">Cancel</button>
        <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">Delete list</button>
      </div>
    </div>
  );
}

function ListEditorAfter() {
  return (
    <div className="space-y-3 rounded-2xl border border-black-800 bg-black-950/50 p-4">
      <input defaultValue="Best Films" readOnly
        className="w-full rounded-2xl border border-black-700 bg-black-950 px-3 py-2 text-sm text-black-100" />
      <input defaultValue="best-films" readOnly
        className="w-full rounded-2xl border border-black-700 bg-black-950 px-3 py-2 text-sm text-black-100" />
      <div className="rounded-2xl border border-black-700 bg-black-950 px-3 py-2 text-sm text-black-200">
        <label className="flex items-center justify-between gap-4">
          <span className="text-xs uppercase tracking-[0.3em] text-black-400">Visibility</span>
          <select className="rounded-full border border-black-700 bg-black-950 px-3 py-1 text-xs uppercase tracking-[0.2em] text-black-100">
            <option>Private</option>
            <option>Public</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">Save changes</button>
        <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">Cancel</button>
        <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">Delete list</button>
      </div>
    </div>
  );
}

// ── Change 3 — Movie detail: stacked → side-by-side ──────────────────────────

const MOCK_MOVIE = {
  title: "Mulholland Drive",
  year: 2001,
  overview: "A bright-eyed aspiring actress travels to Hollywood, only to be swept into a dark identity mystery after befriending an amnesiac woman.",
  imdbRating: "7.9",
  director: "David Lynch",
  dp: "Peter Deming",
};

function MovieDetailBefore() {
  return (
    <div className="rounded-2xl bg-black-900/70 p-4 shadow-2xl">
      <header className="flex flex-col gap-4 text-left">
        <div className="flex flex-col items-start gap-2">
          <div className="flex aspect-[2/3] w-[140px] items-center justify-center rounded-2xl bg-black-800 text-xs text-black-500">
            poster
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-white">{MOCK_MOVIE.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-black-500">
            <span>{MOCK_MOVIE.year}</span>
            <span className="rounded-full bg-black-950/60 px-2 py-0.5 text-xs text-black-200">IMDb {MOCK_MOVIE.imdbRating}</span>
          </div>
          <p className="text-sm leading-relaxed text-black-200">{MOCK_MOVIE.overview}</p>
          <div className="space-y-1 text-sm text-black-200">
            <p><span className="font-semibold text-black-300">Director</span> · {MOCK_MOVIE.director}</p>
            <p><span className="font-semibold text-black-300">DP</span> · {MOCK_MOVIE.dp}</p>
          </div>
        </div>
      </header>
    </div>
  );
}

function MovieDetailAfter() {
  return (
    <div className="rounded-2xl bg-black-900/70 p-4 shadow-2xl">
      {/* flex-row always active in preview to demonstrate the layout */}
      <header className="flex flex-row items-start gap-5 text-left">
        <div className="shrink-0">
          <div className="flex aspect-[2/3] w-[140px] items-center justify-center rounded-2xl bg-black-800 text-xs text-black-500">
            poster
          </div>
        </div>
        <div className="space-y-2 min-w-0">
          <h1 className="text-2xl font-semibold text-white">{MOCK_MOVIE.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-black-500">
            <span>{MOCK_MOVIE.year}</span>
            <span className="rounded-full bg-black-950/60 px-2 py-0.5 text-xs text-black-200">IMDb {MOCK_MOVIE.imdbRating}</span>
          </div>
          <p className="text-sm leading-relaxed text-black-200">{MOCK_MOVIE.overview}</p>
          <div className="space-y-1 text-sm text-black-200">
            <p><span className="font-semibold text-black-300">Director</span> · {MOCK_MOVIE.director}</p>
            <p><span className="font-semibold text-black-300">DP</span> · {MOCK_MOVIE.dp}</p>
          </div>
        </div>
      </header>
    </div>
  );
}

// ── Change 4 — Search icon: h-8 w-8 → h-5 w-5 ───────────────────────────────

function SearchBefore() {
  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-3xl bg-black-950/70 px-4 py-3 shadow-inner">
      <span className="flex items-center justify-center rounded-full p-2 text-white" aria-hidden>
        <Search className="h-8 w-8" />
      </span>
      <input type="search" placeholder="Search" readOnly
        className="flex-1 bg-transparent text-lg text-black-100 placeholder:text-black-400 focus:outline-none" />
    </div>
  );
}

function SearchAfter() {
  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-3xl bg-black-950/70 px-4 py-3 shadow-inner">
      <span className="flex items-center justify-center rounded-full p-2 text-white" aria-hidden>
        <Search className="h-5 w-5" />
      </span>
      <input type="search" placeholder="Search" readOnly
        className="flex-1 bg-transparent text-lg text-black-100 placeholder:text-black-400 focus:outline-none" />
    </div>
  );
}

// ── Preview page ──────────────────────────────────────────────────────────────

export default function PreviewPage() {
  return (
    <div className="min-h-screen px-4 py-10 sm:px-8" style={{ background: "#0a0a0a", color: "#ededed" }}>
      <div className="mx-auto max-w-[960px] space-y-16">

        {/* Header */}
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em]" style={{ color: "#555" }}>ui preview — production unaffected</p>
          <h1 className="text-3xl font-semibold text-white">Proposed Changes</h1>
          <p className="text-sm" style={{ color: "#888" }}>
            6 changes across 3 files. Hover the &quot;after&quot; cards to see the hover effect.
          </p>
        </header>

        {/* ── Change 1+2: List gallery ──────────────────────────────────────── */}
        <section className="space-y-5">
          <DiffLabel label="Hover effect + movie count on cards" file="src/components/list-gallery.tsx" />
          <div className="grid gap-8 sm:grid-cols-2">
            <Column label="Before">
              <div className="grid grid-cols-2 gap-3">
                {MOCK_LISTS.map((l) => <ListCardBefore key={l.id} list={l} />)}
              </div>
            </Column>
            <Column label="After — hover a card">
              <div className="grid grid-cols-2 gap-3">
                {MOCK_LISTS.map((l) => <ListCardAfter key={l.id} list={l} />)}
              </div>
            </Column>
          </div>
        </section>

        <hr style={{ borderColor: "#1f1f1f" }} />

        {/* ── Change 3: List editor colors ─────────────────────────────────── */}
        <section className="space-y-5">
          <DiffLabel label="Edit form color tokens: slate-* → black-*" file="src/components/list-editor.tsx" />
          <div className="grid gap-8 sm:grid-cols-2">
            <Column label="Before (slate — cooler, lighter grey)">
              <ListEditorBefore />
            </Column>
            <Column label="After (black — matches rest of app)">
              <ListEditorAfter />
            </Column>
          </div>
        </section>

        <hr style={{ borderColor: "#1f1f1f" }} />

        {/* ── Change 4: Movie detail layout ────────────────────────────────── */}
        <section className="space-y-5">
          <DiffLabel label="Poster side-by-side with info on desktop" file="src/app/movies/[id]/page.tsx" />
          <div className="grid gap-8 sm:grid-cols-2">
            <Column label="Before (always stacked)">
              <MovieDetailBefore />
            </Column>
            <Column label="After (poster left, text right)">
              <MovieDetailAfter />
            </Column>
          </div>
        </section>

        <hr style={{ borderColor: "#1f1f1f" }} />

        {/* ── Change 5+6: Search bar ────────────────────────────────────────── */}
        <section className="space-y-5">
          <DiffLabel label="Search icon: 32px → 20px" file="src/components/tmdb-search-bar.tsx" />
          <div className="grid gap-8 sm:grid-cols-2">
            <Column label="Before (h-8 w-8)">
              <SearchBefore />
            </Column>
            <Column label="After (h-5 w-5)">
              <SearchAfter />
            </Column>
          </div>
          <p className="text-xs" style={{ color: "#555" }}>
            Also in this file: removing the dead <code className="rounded bg-white/5 px-1 py-0.5">const isOpen = true</code> constant and its associated <code className="rounded bg-white/5 px-1 py-0.5">useEffect</code> — no visible change.
          </p>
        </section>

        <footer className="pt-4 text-center text-xs" style={{ color: "#444" }}>
          /preview — delete this file when done
        </footer>

      </div>
    </div>
  );
}
