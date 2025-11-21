"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SavedList } from "@/lib/list-store";

export function ListEditor({ list }: { list: SavedList }) {
  const [title, setTitle] = useState(list.title);
  const [slug, setSlug] = useState(list.slug);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setMessage(null);
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug }),
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

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="flex flex-col text-sm text-slate-300">
        Title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
      </label>
      <label className="flex flex-col text-sm text-slate-300">
        Slug
        <input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          className="mt-1 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
      </label>
      {message && <p className="text-xs text-slate-400">{message}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
