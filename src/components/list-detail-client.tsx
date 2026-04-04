"use client";

import { useState } from "react";
import type { SavedList } from "@/lib/list-store";
import { ListEditor } from "@/components/list-editor";
import { ListExportButton } from "@/components/list-export-button";
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

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-5">
      {isEditing ? (
        <section className="rounded-2xl bg-black-950/60 p-4 sm:p-5">
          <ListEditor list={list} viewerEmail={viewerEmail} canEdit={list.canEdit} onEditingChange={setIsEditing} />
        </section>
      ) : null}

      <section className="rounded-2xl bg-black-950/60 p-4 sm:p-5">
        {!isEditing ? (
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
