"use client";

import { useState, useTransition } from "react";
import { addFavorite, removeFavorite } from "@/lib/list-store";

type FavoriteToggleProps = {
  listId: string;
  userEmail: string;
  initialFavorite: boolean;
};

export function FavoriteToggle({ listId, userEmail, initialFavorite }: FavoriteToggleProps) {
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    if (isPending) return;
    startTransition(async () => {
      try {
        setMessage(null);
        if (isFavorite) {
          await removeFavorite(listId, userEmail);
          setIsFavorite(false);
          setMessage("Removed from favorites");
        } else {
          await addFavorite(listId, userEmail);
          setIsFavorite(true);
          setMessage("Saved to favorites");
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update favorite");
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className="min-h-11 rounded-full bg-white px-5 py-2.5 text-xs font-medium uppercase tracking-[0.3em] text-black transition hover:brightness-95 active:brightness-90 disabled:opacity-60"
      >
        {isPending ? "Saving" : isFavorite ? "Favorited" : "Favorite"}
      </button>
      {message && <span className="text-[11px] text-black-500">{message}</span>}
    </div>
  );
}
