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
};

export function ListDetailClient({
  list,
  viewerEmail,
  ratingsMap,
  fromParam,
}: ListDetailClientProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-black-950/60 p-4 sm:p-5">
        <ListEditor list={list} viewerEmail={viewerEmail} canEdit={list.canEdit} onEditingChange={setIsEditing} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-black-950/60 p-4 sm:p-5">
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
