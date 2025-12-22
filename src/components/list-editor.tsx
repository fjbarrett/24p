"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SavedList } from "@/lib/list-store";
import { DEFAULT_LIST_COLOR_ID, normalizeListColor } from "@/lib/list-colors";
import { rustApiFetch } from "@/lib/rust-api-client";

export function ListEditor({
  list,
  viewerEmail,
  onEditingChange,
}: {
  list: SavedList;
  viewerEmail?: string | null;
  onEditingChange?: (isEditing: boolean) => void;
}) {
  const normalizedViewerEmail = viewerEmail?.trim().toLowerCase() ?? "";
  const isOwner = Boolean(normalizedViewerEmail && normalizedViewerEmail === list.userEmail);
  const [title, setTitle] = useState(list.title);
  const [slug, setSlug] = useState(list.slug);
  const [color, setColor] = useState(normalizeListColor(list.color ?? DEFAULT_LIST_COLOR_ID));
  const [visibility, setVisibility] = useState<SavedList["visibility"]>(list.visibility);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();
  const listPath = list.username ? `/${list.username}/${slug}` : `/${slug}`;

  if (!isOwner) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-black-300" style={{ paddingLeft: 16 }}>
          {listPath}
        </p>
        <p className="text-xs text-black-500" style={{ paddingLeft: 16 }}>
          Only the creator can edit this list.
        </p>
      </div>
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        setMessage(null);
        await rustApiFetch(`/lists/${list.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title, slug, color, visibility, userEmail: list.userEmail }),
        });
        setMessage("Saved changes");
        setIsEditing(false);
        onEditingChange?.(false);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save");
      }
    });
  }

  if (!isEditing) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-black-300" style={{ paddingLeft: 16 }}>{listPath}</p>
        {message && <p className="text-xs text-black-400" style={{ paddingLeft: 16 }}>{message}</p>}
        <button
          type="button"
          onClick={() => {
            setIsEditing(true);
            onEditingChange?.(true);
          }}
          className="rounded-full px-4 py-2 text-sm text-black-100 transition hover:bg-black-800"
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
      <div className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
        <label className="flex items-center justify-between gap-4">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Visibility</span>
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as SavedList["visibility"])}
            className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-100"
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </label>
        {!list.username && visibility === "public" && (
          <p className="mt-2 text-[11px] text-slate-400">
            Set a username first so your list can go public.
          </p>
        )}
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
            setVisibility(list.visibility);
            setIsEditing(false);
            onEditingChange?.(false);
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
              try {
                setMessage(null);
                await rustApiFetch(`/lists/${list.id}`, {
                  method: "DELETE",
                  body: JSON.stringify({ userEmail: list.userEmail }),
                });
                router.push("/");
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Unable to delete");
              }
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
