"use client";

import Link from "next/link";
import type { SavedList } from "@/lib/list-store";

type ListGalleryProps = {
  lists: SavedList[];
  title?: string;
  emptyMessage?: string;
  id?: string;
  showOwner?: boolean;
  viewerEmail?: string;
};

export function ListGallery({
  lists,
  title = "Lists",
  emptyMessage,
  id = "lists",
  showOwner = false,
}: ListGalleryProps) {
  if (!lists.length) {
    return (
      <section id={id} className="rounded-3xl border border-white/10 bg-black-900/40 p-6 text-center">
        {title ? <p className="text-xs uppercase tracking-[0.4em] text-black-400">{title}</p> : null}
        <p className={`${title ? "mt-2 " : ""}text-sm text-black-500`}>
          {emptyMessage ?? "No lists yet. Use the buttons below to create or import your first one."}
        </p>
      </section>
    );
  }

  return (
    <section id={id} className="space-y-4">
      {title ? <p className="text-xs uppercase tracking-[0.4em] text-black-400">{title}</p> : null}
      <div className="grid gap-6 sm:grid-cols-2">
        {lists.map((list) => {
          const href = list.username ? `/${list.username}/${list.slug}` : null;
          const ownerHref = list.username ? `/${list.username}` : null;

          return (
            <div key={list.id} className={!href ? "cursor-not-allowed" : undefined}>
              <div
                className="relative overflow-hidden rounded-2xl bg-neutral-900"
                style={{ aspectRatio: "2.39 / 1" }}
              >
                {href && <Link href={href} className="absolute inset-0 z-10" aria-label={list.title} />}
                <div className="relative z-0 flex h-full flex-col justify-end p-4">
                  {showOwner && list.username && ownerHref ? (
                    <Link
                      href={ownerHref}
                      className="relative z-20 mb-1 self-start text-[11px] uppercase tracking-[0.4em] text-white/40 hover:text-white"
                    >
                      @{list.username}
                    </Link>
                  ) : null}
                  <h3 className="text-xl font-semibold text-white">{list.title}</h3>
                  {typeof list.movies?.length === "number" && (
                    <p className="mt-0.5 text-xs text-white/50">
                      {list.movies.length} {list.movies.length === 1 ? "film" : "films"}
                    </p>
                  )}
                  {!href && <p className="mt-0.5 text-xs text-white/40">Set a username to share this list.</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
