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
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.3em] transition disabled:opacity-60 ${isFavorite ? "border-[#0085ff] bg-[#0085ff]/15 text-[#6bb8ff] hover:bg-[#0085ff]/20" : "border-white/15 text-white/70 hover:bg-white/5"}`}
      >
        {isPending ? "Saving" : isFavorite ? "Favorited" : "Favorite"}
      </button>
      {message && <span className="text-[11px] text-black-500">{message}</span>}
    </div>
  );
}
