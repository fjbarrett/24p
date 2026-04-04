"use client";

import { useState } from "react";
import type { SavedList } from "@/lib/list-store";
import { ListEditor } from "@/components/list-editor";
import { ListMoviesGrid } from "@/components/list-movies-grid";

type ListDetailClientProps = {
  list: SavedList;
  viewerEmail: string | null;
  ratingsMap: Record<number, number>;
  fromParam: string;
  initialEditing?: boolean;
};

export function ListDetailClient({
  list,
  viewerEmail,
  ratingsMap,
  fromParam,
  initialEditing = false,
}: ListDetailClientProps) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const normalizedViewerEmail = viewerEmail?.trim().toLowerCase() ?? "";
  const isOwner = Boolean(normalizedViewerEmail && normalizedViewerEmail === list.userEmail);

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-5">
      {isEditing ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Edit list"
        >
          <section className="w-full max-w-[760px] rounded-[28px] bg-black-950/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-5">
            <ListEditor list={list} viewerEmail={viewerEmail} canEdit={list.canEdit} onEditingChange={setIsEditing} startEditing />
          </section>
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
          tmdbIds={list.movies}
          ratingsMap={ratingsMap}
          fromParam={fromParam}
          listSlug={list.slug}
          listTitle={list.title}
          listId={list.id}
          userEmail={viewerEmail}
          isEditing={isEditing}
        />
      </section>
    </div>
  );
}
