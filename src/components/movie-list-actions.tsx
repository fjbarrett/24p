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
  const [selectedListId, setSelectedListId] = useState(lists[0]?.id ?? "");
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
    <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Add to list</p>
        <form className="mt-3 space-y-3" onSubmit={addToExisting}>
          <label className="text-sm text-slate-300">
            Choose existing
            <select
              value={selectedListId}
              onChange={(event) => setSelectedListId(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Select a list</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-full border border-sky-300 px-4 py-2 text-sm text-sky-200 transition hover:bg-sky-300/10 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Add to list"}
          </button>
        </form>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Create new list</p>
        <form className="mt-3 space-y-3" onSubmit={createNew}>
          <label className="text-sm text-slate-300">
            Title
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
          >
            {isPending ? "Creating..." : "Create and add"}
          </button>
        </form>
      </div>

      {message && <p className="text-xs text-slate-300">{message}</p>}
    </div>
  );
}
