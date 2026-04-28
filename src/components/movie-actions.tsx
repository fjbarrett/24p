"use client";

import { AddToListButton } from "@/components/add-to-list-loader";

type MovieActionsProps = {
  tmdbId: number;
  userEmail: string;
  imdbId?: string | null;
  title?: string;
  releaseYear?: number;
  mediaType?: "movie" | "tv";
};

export function MovieActions({ tmdbId, userEmail, mediaType = "movie" }: MovieActionsProps) {
  if (!userEmail.trim()) return null;

  return (
    <div className="mt-3">
      <AddToListButton
        tmdbId={tmdbId}
        userEmail={userEmail}
        mediaType={mediaType}
      />
    </div>
  );
}
