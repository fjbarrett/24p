"use client";

import Link from "next/link";
import type { SavedList } from "@/lib/list-store";

const accentColors = ["#e864c6", "#8c63e0", "#3d7fcf", "#54c295", "#d8a534", "#e68630", "#e05555"];

function pickAccent(list: { id: string; slug?: string; title?: string }) {
  const key = list.slug || list.title || list.id;
  const shift = Array.from(key).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % accentColors.length, 0);
  return accentColors[shift];
}

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
        <p className="text-xs uppercase tracking-[0.4em] text-black-400">{title}</p>
        <p className="mt-2 text-sm text-black-500">
          {emptyMessage ?? "No lists yet. Use the buttons below to create or import your first one."}
        </p>
      </section>
    );
  }

  return (
    <section id={id} className="space-y-4">
      <p className="text-xs uppercase tracking-[0.4em] text-black-400">{title}</p>
      <div className="grid gap-6 sm:grid-cols-2">
        {lists.map((list) => {
          const href = list.username ? `/${list.username}/${list.slug}` : null;
          const accent = pickAccent(list);
          const card = (
            <div
              className="group relative block h-40 overflow-hidden rounded-2xl border border-black-800 bg-black-950"
            >
              <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black-950">
                <div
                  className="absolute inset-x-4 top-4 h-[3px] rounded-full opacity-70"
                  style={{ background: accent }}
                  aria-hidden
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black-900 via-black-950 to-black-950" />
                <div className="relative z-10 flex h-full flex-col justify-end p-4">
                  {showOwner && list.username && (
                    <p className="text-[11px] uppercase tracking-[0.4em] text-black-400">@{list.username}</p>
                  )}
                  <h3 className="text-xl font-semibold text-white">{list.title}</h3>
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
            <Link key={list.id} href={href}>
              {card}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
