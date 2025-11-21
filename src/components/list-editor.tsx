"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SavedList } from "@/lib/list-store";
import {
  DEFAULT_LIST_COLOR_ID,
  LIST_COLOR_OPTIONS,
  getListColorStyles,
  normalizeListColor,
} from "@/lib/list-colors";

export function ListEditor({ list }: { list: SavedList }) {
  const [title, setTitle] = useState(list.title);
  const [slug, setSlug] = useState(list.slug);
  const [color, setColor] = useState(normalizeListColor(list.color ?? DEFAULT_LIST_COLOR_ID));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug, color }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage(data.error ?? "Unable to save");
        return;
      }
      setMessage("Saved changes");
      router.refresh();
    });
  }

  if (!isEditing) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-300">/{slug}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Card color</p>
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20"
            style={getListColorStyles(color).surface}
            aria-hidden
          />
          <span className="text-sm text-slate-300">
            {getListColorStyles(color).option?.label ?? color}
          </span>
        </div>
        {message && <p className="text-xs text-slate-400">{message}</p>}
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="rounded-full border border-slate-500 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-800"
        >
          Edit list
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        aria-label="Title"
      />
      <input
        value={slug}
        onChange={(event) => setSlug(event.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        aria-label="Slug"
      />
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Card color</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LIST_COLOR_OPTIONS.map((option) => {
            const isActive = color === option.id;
            return (
              <button
                type="button"
                key={option.id}
                onClick={() => setColor(option.id)}
                className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-sm transition ${
                  isActive ? "border-white/70 text-white" : "border-white/10 text-slate-200 hover:border-white/30"
                }`}
                style={{ backgroundImage: option.overlay, backgroundColor: option.surface }}
                aria-pressed={isActive}
              >
                <span>{option.label}</span>
                <span
                  className="h-4 w-4 rounded-full border border-white/20"
                  style={{ backgroundColor: option.ring }}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </div>
      {message && <p className="text-xs text-slate-400">{message}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setTitle(list.title);
            setSlug(list.slug);
            setColor(normalizeListColor(list.color ?? DEFAULT_LIST_COLOR_ID));
            setIsEditing(false);
          }}
          className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              setMessage(null);
              const response = await fetch(`/api/lists/${list.id}`, { method: "DELETE" });
              if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                setMessage(data.error ?? "Unable to delete");
                return;
              }
              router.push("/");
              router.refresh();
            });
          }}
          className="rounded-full border border-rose-400 px-4 py-2 text-sm text-rose-300 disabled:opacity-50"
        >
          {isPending ? "Deleting..." : "Delete list"}
        </button>
      </div>
    </form>
  );
}
