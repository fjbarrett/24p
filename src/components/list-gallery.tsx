"use client";

import Link from "next/link";
import type { SavedList } from "@/lib/list-store";

const rainbowStops = [
  "#e864c6",
  "#8c63e0",
  "#3d7fcf",
  "#54c295",
  "#d8a534",
  "#e68630",
  "#e05555",
  "#e864c6",
];

function pickGradient(list: { id: string; slug?: string; title?: string }) {
  const key = list.slug || list.title || list.id;
  const shift = Array.from(key).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % rainbowStops.length, 0);
  const rotated = [...rainbowStops.slice(shift), ...rainbowStops.slice(0, shift)];
  return `linear-gradient(90deg, ${rotated.join(", ")})`;
}

type ListGalleryProps = {
  lists: SavedList[];
};

export function ListGallery({ lists }: ListGalleryProps) {
  if (!lists.length) {
    return (
      <section id="lists" className="rounded-3xl border border-white/10 bg-black-900/40 p-6 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-black-400">Lists</p>
        <p className="mt-2 text-sm text-black-500">No lists yet. Use the buttons below to create or import your first one.</p>
      </section>
    );
  }

  return (
    <section id="lists" className="space-y-4">
      {/* <p className="text-xs uppercase tracking-[0.4em] text-black-400">Your latest lists</p> */}
      <div className="grid gap-6 sm:grid-cols-2">
        {lists.map((list) => (
          <Link key={list.id} href={`/lists/${list.slug}`}>
            <div
              className="group relative block h-48 overflow-hidden rounded-2xl border border-black p-[4px]"
              style={{ background: pickGradient(list) }}
            >
              <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gradient-to-br from-black-900 via-black-950 to-black-900">
                <div className="pointer-events-none absolute inset-[6px] rounded-2xl bg-gradient-to-br from-transparent via-black/10 to-black/30 blur-sm" />
                <div className="relative z-10 flex h-full flex-col justify-end p-5">
                  <h3 className="text-2xl font-bold text-white">{list.title}</h3>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
