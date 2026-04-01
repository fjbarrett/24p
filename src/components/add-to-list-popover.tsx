"use client";

import { useEffect, useId, useState } from "react";
import { Plus } from "lucide-react";
import { addMovieToList, type SavedList } from "@/lib/list-store";

type AddToListPopoverProps = {
  lists: SavedList[];
  tmdbId: number;
  userEmail: string;
};

export function AddToListPopover({ lists, tmdbId, userEmail }: AddToListPopoverProps) {
  const normalizedEmail = userEmail.trim().toLowerCase();
  const noLists = !lists.length;
  const panelId = useId();
  const selectId = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>(lists[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  useEffect(() => {
    if (lists.length && !selectedListId) {
      setSelectedListId(lists[0]?.id ?? "");
    }
  }, [lists, selectedListId]);

  if (!normalizedEmail) {
    return (
      <div className="rounded-2xl bg-black-950/60 p-3">
        <p className="text-sm text-black-200">Sign in to save this to a list.</p>
      </div>
    );
  }

  async function handleAdd() {
    if (!selectedListId) {
      setStatus({ message: "Select a list first.", tone: "error" });
      return;
    }
    try {
      setSaving(true);
      setStatus(null);
      await addMovieToList(selectedListId, tmdbId, normalizedEmail);
      setStatus({ message: "Added to list.", tone: "success" });
      setIsOpen(false);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unable to add movie.";
      setStatus({ message: detail, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-black-950/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.3em] text-black-500">Save</p>
        <button
          type="button"
          aria-label="Add this movie to a list"
          aria-controls={panelId}
          aria-expanded={isOpen}
          onClick={() => {
            setIsOpen((current) => !current);
            setStatus(null);
          }}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {isOpen && (
        <div id={panelId} className="mt-2 space-y-2 rounded-2xl bg-black-900/80 p-3 shadow-inner">
          {noLists ? (
            <p className="text-sm text-black-400">Create a list first to save movies.</p>
          ) : (
            <>
              <label className="sr-only" htmlFor={selectId}>
                Select a list
              </label>
              <select
                id={selectId}
                value={selectedListId}
                onChange={(event) => setSelectedListId(event.target.value)}
                className="w-full rounded-2xl bg-black-800/80 px-3 py-2 text-sm text-black-100 outline-none"
              >
                {lists.map((list) => (
                  <option key={list.id} value={list.id} className="bg-black-900 text-black-100">
                    {list.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="flex w-full items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black shadow transition hover:brightness-95 disabled:opacity-60"
                onClick={handleAdd}
                disabled={saving}
              >
                {saving ? "Adding..." : "Add to list"}
              </button>
            </>
          )}
        </div>
      )}

      {status ? (
        <p className={`mt-1 text-xs ${status.tone === "success" ? "text-emerald-300" : "text-rose-300"}`} role="status">
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
