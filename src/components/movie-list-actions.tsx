"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SavedList } from "@/lib/list-store";

type MovieListActionsProps = {
  lists: SavedList[];
  tmdbId: number;
  movieTitle: string;
};

export function MovieListActions({ lists, tmdbId, movieTitle }: MovieListActionsProps) {
  const [selectedListId, setSelectedListId] = useState(
    lists[0]?.id ?? lists[0]?.slug ?? "",
  );
  const [newTitle, setNewTitle] = useState(`${movieTitle} watch party`);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function addToExisting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedListId) {
      setMessage("Select a list first");
      return;
    }
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/lists/${selectedListId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage(data.error ?? "Unable to add movie");
        return;
      }
      setMessage("Movie added to list");
      router.refresh();
    });
  }

  function createNew(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTitle.trim()) {
      setMessage("Enter a title for the new list");
      return;
    }
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, tmdbId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage(data.error ?? "Unable to create list");
        return;
      }
      setNewTitle("");
      setMessage("New list created with movie");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <form className="space-y-3" onSubmit={addToExisting}>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2">
          <span aria-hidden className="text-lg">
            📂
          </span>
          <select
            value={selectedListId}
            onChange={(event) => setSelectedListId(event.target.value)}
            className="w-full bg-transparent text-sm text-slate-100 outline-none"
          >
            <option value="">Select a list</option>
            {lists.map((list) => (
              <option key={list.id || list.slug} value={list.id || list.slug} className="bg-slate-900 text-slate-100">
                {list.title}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-400 to-slate-600 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-slate-800/30 transition hover:brightness-110 disabled:opacity-50"
        >
          <span aria-hidden className="text-lg">
            ➕
          </span>
          <span>{isPending ? "Saving..." : "Add to list"}</span>
        </button>
      </form>

      <form className="space-y-3" onSubmit={createNew}>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2">
          <span aria-hidden className="text-lg">
            🆕
          </span>
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
            placeholder="New list title"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-300 to-slate-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-slate-700/30 transition hover:brightness-110 disabled:opacity-50"
        >
          <span aria-hidden className="text-lg">
            ✅
          </span>
          <span>{isPending ? "Creating..." : "Create + add"}</span>
        </button>
      </form>

      {message && <p className="text-xs text-center text-slate-300">{message}</p>}
    </div>
  );
}
