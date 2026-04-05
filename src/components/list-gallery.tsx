"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SavedList } from "@/lib/list-store";
import { deleteList } from "@/lib/list-store";

const LONG_PRESS_MS = 500;

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
  viewerEmail,
}: ListGalleryProps) {
  const [openListId, setOpenListId] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  function startPress(listId: string) {
    timerRef.current = setTimeout(() => setOpenListId(listId), LONG_PRESS_MS);
  }

  function cancelPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function closeMenu() {
    setOpenListId(null);
    setShareMessage(null);
  }

  function handleDelete(list: SavedList) {
    if (!viewerEmail) return;
    startTransition(async () => {
      await deleteList(list.id, viewerEmail);
      closeMenu();
      router.refresh();
    });
  }

  function handleShare(list: SavedList) {
    if (!list.username) return;
    const url = `${window.location.origin}/${list.username}/${list.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareMessage("Copied!");
      setTimeout(() => { closeMenu(); }, 1200);
    });
  }

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

  const normalizedViewer = viewerEmail?.trim().toLowerCase() ?? "";

  return (
    <section id={id} className="space-y-4">
      {title ? <p className="text-xs uppercase tracking-[0.4em] text-black-400">{title}</p> : null}
      <div className="grid gap-6 sm:grid-cols-2">
        {lists.map((list) => {
          const href = list.username ? `/${list.username}/${list.slug}` : null;
          const ownerHref = list.username ? `/${list.username}` : null;
          const isMenuOpen = openListId === list.id;
          const isOwner = Boolean(normalizedViewer && normalizedViewer === list.userEmail);
          const canEdit = isOwner || Boolean(list.canEdit);

          return (
            <div key={list.id} className={!href ? "cursor-not-allowed" : undefined}>
              <div
                className="group relative overflow-hidden rounded-2xl bg-neutral-900"
                style={{ aspectRatio: "2.39 / 1" }}
                onPointerDown={() => startPress(list.id)}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => { e.preventDefault(); setOpenListId(list.id); }}
              >
                {/* normal card content */}
                {!isMenuOpen && href && (
                  <Link href={href} className="absolute inset-0 z-10" aria-label={list.title} />
                )}
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

                {/* long-press action overlay */}
                {isMenuOpen && (
                  <div
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl bg-black/85 backdrop-blur-sm"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {shareMessage ? (
                      <p className="text-sm font-medium text-white">{shareMessage}</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        {isOwner && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDelete(list)}
                            className="rounded-full bg-rose-500/20 px-4 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/30 disabled:opacity-40"
                          >
                            {isPending ? "Deleting…" : "Delete"}
                          </button>
                        )}
                        {canEdit && href && (
                          <Link
                            href={`${href}?edit=1`}
                            className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                          >
                            Edit
                          </Link>
                        )}
                        {list.username && (
                          <button
                            type="button"
                            onClick={() => handleShare(list)}
                            className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                          >
                            Share
                          </button>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={closeMenu}
                      className="text-xs text-white/40 hover:text-white/70"
                    >
                      dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
