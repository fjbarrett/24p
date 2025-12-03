"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SavedList } from "@/lib/list-store";
import { rustApiFetch } from "@/lib/rust-api-client";

type MovieListActionsProps = {
  lists: SavedList[];
  tmdbId: number;
  movieTitle: string;
  userEmail: string | null;
};

export function MovieListActions({ lists, tmdbId, movieTitle, userEmail }: MovieListActionsProps) {
  const normalizedEmail = userEmail?.trim().toLowerCase() ?? "";
  const [selectedListId, setSelectedListId] = useState(lists[0]?.id ?? "");
  const [newTitle, setNewTitle] = useState(`${movieTitle} watch party`);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!normalizedEmail) {
    return (
      <div className="space-y-2 rounded-2xl bg-black-950/70 p-4">
        <p className="text-sm text-black-200">Sign in to create or save lists.</p>
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

  function createNew(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTitle.trim()) {
      setMessage("Enter a title for the new list");
      return;
    }
    startTransition(async () => {
      try {
        setMessage(null);
        await rustApiFetch("/lists", {
          method: "POST",
          body: JSON.stringify({ title: newTitle, tmdbId, userEmail: normalizedEmail }),
        });
        setNewTitle("");
        setMessage("New list created with movie");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to create list");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-2xl bg-black-950/70 p-4">
      <form className="space-y-3" onSubmit={addToExisting}>
        <div className="flex items-center gap-2 rounded-xl bg-black-900/70 px-3 py-2">
          <span aria-hidden className="text-lg">
            📂
          </span>
          <select
            value={selectedListId}
            onChange={(event) => setSelectedListId(event.target.value)}
            className="w-full bg-transparent text-sm text-black-100 outline-none"
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
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-black-400 to-black-600 px-4 py-2 text-sm font-semibold text-black-950 shadow-lg shadow-black-800/30 transition hover:brightness-110 disabled:opacity-50"
        >
          <span aria-hidden className="text-lg">
            ➕
          </span>
          <span>{isPending ? "Saving..." : "Add to list"}</span>
        </button>
      </form>

      <form className="space-y-3" onSubmit={createNew}>
        <div className="flex items-center gap-2 rounded-xl bg-black-900/70 px-3 py-2">
          <span aria-hidden className="text-lg">
            🆕
          </span>
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            className="w-full bg-transparent text-sm text-black-100 placeholder:text-black-500 outline-none"
            placeholder="New list title"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-black-300 to-black-500 px-4 py-2 text-sm font-semibold text-black-950 shadow-lg shadow-black-700/30 transition hover:brightness-110 disabled:opacity-50"
        >
          <span aria-hidden className="text-lg">
            ✅
          </span>
          <span>{isPending ? "Creating..." : "Create + add"}</span>
        </button>
      </form>

      {message && <p className="text-xs text-center text-black-300">{message}</p>}
    </div>
  );
}
