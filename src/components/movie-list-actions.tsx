"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SavedList } from "@/lib/list-store";
import { rustApiFetch } from "@/lib/rust-api-client";

type MovieListActionsProps = {
  lists: SavedList[];
  tmdbId: number;
  userEmail: string | null;
};

export function MovieListActions({ lists, tmdbId, userEmail }: MovieListActionsProps) {
  const normalizedEmail = userEmail?.trim().toLowerCase() ?? "";
  const [selectedListId, setSelectedListId] = useState(lists[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!normalizedEmail) {
    return (
      <div className="space-y-2 rounded-2xl bg-black-950/70 p-4">
        <p className="text-sm text-black-200">Sign in to save this to a list.</p>
      </div>
    );
  }

  function addToExisting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedListId) {
      setMessage("Select a list first");
      return;
    }
    startTransition(async () => {
      try {
        setMessage(null);
        await rustApiFetch(`/lists/${selectedListId}/items`, {
          method: "POST",
          body: JSON.stringify({ tmdbId, userEmail: normalizedEmail }),
        });
        setMessage("Movie added to list");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to add movie");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-2xl bg-black-950/70 p-4">
      <form className="space-y-3" onSubmit={addToExisting}>
        <select
          value={selectedListId}
          onChange={(event) => setSelectedListId(event.target.value)}
          className="w-full rounded-2xl bg-black-900/80 px-4 py-3 text-base text-black-100 outline-none shadow-inner"
          style={{ fontSize: 18 }}
        >
          <option value="">Select a list</option>
          {lists.map((list) => (
            <option
              key={list.id || list.slug}
              value={list.id ?? ""}
              disabled={!list.id}
              className="bg-black-900 text-black-100"
            >
              {list.title}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center rounded-full bg-[#0085ff] px-4 py-3 text-base font-semibold text-white transition hover:bg-[#0070d9] active:bg-[#005db8] disabled:opacity-50"
          style={{ fontSize: 18 }}
        >
          <span>{isPending ? "Saving..." : "Add to list"}</span>
        </button>
      </form>

      {message && <p className="text-xs text-center text-black-300">{message}</p>}
    </div>
  );
}
