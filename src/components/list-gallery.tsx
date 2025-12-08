"use client";

import Link from "next/link";
import { Cog } from "lucide-react";
import type { SavedList } from "@/lib/list-store";
import type { SmartListDefinition } from "@/lib/smart-list-store";
import { getListColorStyles } from "@/lib/list-colors";

type ListGalleryProps = {
  lists: (SavedList | (SmartListDefinition & { isSmart: true }))[];
  onSmartListSelect?: (id: string) => void;
  onSmartListEdit?: (id: string) => void;
};

export function ListGallery({ lists, onSmartListSelect, onSmartListEdit }: ListGalleryProps) {
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
      <div className="grid gap-4 sm:grid-cols-2">
        {lists.map((list) => {
          const isSmart = "isSmart" in list;
          const content = (
            <div className="group relative block h-52 overflow-hidden rounded-3xl border border-white/10 bg-black transition hover:border-black-400">
              <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/10 bg-gradient-to-br from-black-900 via-black-950 to-black-900" />
              <div
                className="pointer-events-none absolute inset-[3px] rounded-3xl opacity-70"
                style={getListColorStyles((list as SavedList).color).overlay}
              />
              <div className="pointer-events-none absolute inset-[6px] rounded-3xl border border-white/5" />
              {isSmart && (
                <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-xs uppercase tracking-[0.2em] text-black-200">
                  <Cog size={16} />
                  Smart
                </div>
              )}
          {isSmart && (
            <div className="absolute right-3 top-3">
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSmartListEdit?.(list.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onSmartListEdit?.(list.id);
                  }
                }}
                className="inline-flex rounded-full border border-black-700 bg-black/70 p-2 text-black-200 transition hover:border-black-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-black-400"
                aria-label={`Edit rules for ${"title" in list ? list.title : "Smart list"}`}
              >
                <Cog size={18} />
              </span>
            </div>
          )}
              <div className="relative z-10 flex h-full flex-col justify-end space-y-1 p-5">
                <h3 className="text-xl font-semibold text-white group-hover:text-black-200">
                  {"title" in list ? list.title : "Untitled"}
                </h3>
              </div>
            </div>
          );

          if (isSmart) {
            return (
              <button
                key={list.id}
                onClick={() => onSmartListSelect?.(list.id)}
                className="text-left"
                aria-label={`Open smart list ${"title" in list ? list.title : "Smart list"}`}
              >
                {content}
              </button>
            );
          }

          return (
            <Link key={list.id} href={`/lists/${(list as SavedList).slug}`}>
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
