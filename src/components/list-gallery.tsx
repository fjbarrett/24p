"use client";

import Link from "next/link";
import Image from "next/image";
import { memo } from "react";
import { getListColorStyles } from "@/lib/list-colors";
import type { SavedList } from "@/lib/list-store";

// How many poster thumbnails to show in a card's strip.
const PREVIEW_COUNT = 5;

type ListCardProps = {
  list: SavedList;
  posterUrls?: string[];
  showOwner?: boolean;
};

// Static card: shows the list's first few posters at rest (resolved server-side
// and passed in), so contents are recognizable on every device with no hover
// fetching. The list color is kept as a small identity accent.
const ListCard = memo(function ListCard({ list, posterUrls = [], showOwner }: ListCardProps) {
  const href = list.username ? `/${list.username}/${list.slug}` : null;
  const { surface, overlay, option } = getListColorStyles(list.color);

  const posters = posterUrls.slice(0, PREVIEW_COUNT);
  const total = list.movies?.length ?? 0;
  const overflow = Math.max(0, total - posters.length);

  const strip = (
    <div className="flex gap-1.5">
      {Array.from({ length: PREVIEW_COUNT }).map((_, index) => {
        const url = posters[index];
        const isLastVisible = index === posters.length - 1;
        return (
          <div
            key={index}
            className="relative aspect-[2/3] flex-1 overflow-hidden rounded-md ring-1 ring-white/5"
            style={url ? undefined : { ...surface, ...overlay }}
          >
            {url ? (
              <Image src={url} alt="" fill sizes="(max-width: 640px) 18vw, 90px" className="object-cover" />
            ) : null}
            {url && isLastVisible && overflow > 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/65 text-sm font-semibold text-white">
                +{overflow}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  const body = (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-white/8 bg-black-900/40 p-3.5 transition hover:border-white/16 hover:bg-black-900/60 sm:p-4">
      {strip}
      <div className="flex flex-col gap-0.5">
        {showOwner && list.username ? (
          <span className="text-[11px] uppercase tracking-[0.35em] text-black-500">@{list.username}</span>
        ) : null}
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: option?.ring }}
          />
          <h3 className="truncate text-base font-semibold text-white">{list.title}</h3>
        </div>
        <p className="text-xs text-black-400">
          {total} {total === 1 ? "film" : "films"}
          {!href ? " · set a username to share" : ""}
        </p>
      </div>
    </div>
  );

  if (!href) {
    return <div className="cursor-not-allowed opacity-90">{body}</div>;
  }

  return (
    <Link
      href={href}
      aria-label={list.title}
      className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      {body}
    </Link>
  );
});

type ListGalleryProps = {
  lists: SavedList[];
  /** listId -> ordered preview poster URLs (resolved server-side). */
  posters?: Record<string, string[]>;
  title?: string;
  emptyMessage?: string;
  id?: string;
  showOwner?: boolean;
  /** Accepted for API compatibility with existing callers; not used here. */
  viewerEmail?: string;
};

export function ListGallery({
  lists,
  posters,
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
      <div className="grid gap-4 sm:grid-cols-2">
        {lists.map((list) => (
          <ListCard key={list.id} list={list} posterUrls={posters?.[list.id]} showOwner={showOwner} />
        ))}
      </div>
    </section>
  );
}
