"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import type { SavedList } from "@/lib/list-store";
import { ListEditor } from "@/components/list-editor";
import { ListExportButton } from "@/components/list-export-button";
import { ListMoviesGrid } from "@/components/list-movies-grid";
import { ListSuggestionsPanel } from "@/components/list-suggestions-panel";

type ListDetailClientProps = {
  list: SavedList;
  viewerEmail: string | null;
  ratingsMap: Record<number, number>;
  fromParam: string;
};

export function ListDetailClient({
  list,
  viewerEmail,
  ratingsMap,
  fromParam,
}: ListDetailClientProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const normalizedViewerEmail = viewerEmail?.trim().toLowerCase() ?? "";
  const isOwner = Boolean(normalizedViewerEmail && normalizedViewerEmail === list.userEmail);

  // Ensure we're client-side before portalling
  if (!mounted && typeof window !== "undefined") {
    setMounted(true);
  }

  const modal =
    isEditing && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-3 py-3 sm:px-4 sm:py-4"
            role="dialog"
            aria-modal="true"
            aria-label="Edit list"
          >
            <section className="relative max-h-[calc(100dvh-24px)] w-full max-w-[820px] overflow-y-auto rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,26,26,0.98),rgba(13,13,13,1))] shadow-[0_36px_120px_rgba(0,0,0,0.72)] ring-1 ring-white/5 sm:max-h-[calc(100dvh-32px)]">
              <ListEditor list={list} viewerEmail={viewerEmail} canEdit={list.canEdit} onEditingChange={setIsEditing} startEditing />
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-5">
      {modal}

      {isOwner ? (
        <div className="flex justify-center pb-1 pt-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            aria-label="Edit list"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white/40 transition hover:bg-white/8 hover:text-white/70"
          >
            <Pencil className="h-3 w-3" strokeWidth={2.25} />
            Edit
          </button>
        </div>
      ) : null}

      <section className="rounded-2xl bg-black-950/60 p-4 sm:p-5">
        {!isEditing && !isOwner ? (
          <div className="mb-4">
            <ListEditor
              list={list}
              viewerEmail={viewerEmail}
              canEdit={list.canEdit}
              onEditingChange={setIsEditing}
              hideOwnerEditButton
            />
          </div>
        ) : null}
        <ListMoviesGrid
          items={list.items}
          ratingsMap={ratingsMap}
          fromParam={fromParam}
          listSlug={list.slug}
          listTitle={list.title}
          listId={list.id}
          userEmail={viewerEmail}
          isEditing={isEditing && !isOwner}
          canDelete={isOwner}
        />
      </section>
      {isOwner ? <ListSuggestionsPanel listId={list.id} /> : null}

      <div className="flex justify-center">
        <ListExportButton
          tmdbIds={list.movies}
          ratingsMap={ratingsMap}
          listSlug={list.slug}
          listTitle={list.title}
        />
      </div>
    </div>
  );
}
