"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ListShare, SavedList } from "@/lib/list-store";
import { addListShare, loadListShares, removeListShare, updateListSharePermission } from "@/lib/list-store";
import { DEFAULT_LIST_COLOR_ID, LIST_COLOR_OPTIONS, normalizeListColor } from "@/lib/list-colors";
import { apiFetch } from "@/lib/api-client";

export function ListEditor({
  list,
  viewerEmail,
  canEdit,
  onEditingChange,
  hideOwnerEditButton = false,
  startEditing = false,
}: {
  list: SavedList;
  viewerEmail?: string | null;
  canEdit?: boolean;
  onEditingChange?: (isEditing: boolean) => void;
  hideOwnerEditButton?: boolean;
  startEditing?: boolean;
}) {
  const normalizedViewerEmail = viewerEmail?.trim().toLowerCase() ?? "";
  const isOwner = Boolean(normalizedViewerEmail && normalizedViewerEmail === list.userEmail);
  const canEditList = isOwner || Boolean(canEdit);
  const [title, setTitle] = useState(list.title);
  const [slug, setSlug] = useState(list.slug);
  const [color, setColor] = useState(normalizeListColor(list.color ?? DEFAULT_LIST_COLOR_ID));
  const [visibility, setVisibility] = useState<SavedList["visibility"]>(list.visibility);
  const [message, setMessage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareUsername, setShareUsername] = useState("");
  const [shares, setShares] = useState<ListShare[]>([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(startEditing);
  const router = useRouter();
  const canShare = Boolean(list.username);

  useEffect(() => {
    if (!isOwner || !isEditing) return;
    let isActive = true;
    setIsLoadingShares(true);
    setShareMessage(null);
    loadListShares(list.id, list.userEmail)
      .then((entries) => {
        if (isActive) {
          setShares(entries);
        }
      })
      .catch((error) => {
        if (isActive) {
          setShareMessage(error instanceof Error ? error.message : "Unable to load shares");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingShares(false);
        }
      });
    return () => {
      isActive = false;
    };
  }, [isEditing, isOwner, list.id, list.userEmail]);

  function formatShareLabel(share: ListShare) {
    if (share.username) return `@${share.username}`;
    return share.userEmail;
  }

  async function handleAddShare() {
    const trimmed = shareUsername.trim();
    if (!trimmed) {
      setShareMessage("Enter a username to share this list.");
      return;
    }
    setIsSharing(true);
    setShareMessage(null);
    try {
      const nextShares = await addListShare(list.id, list.userEmail, trimmed);
      setShares(nextShares);
      setShareUsername("");
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : "Unable to share list");
    } finally {
      setIsSharing(false);
    }
  }

  async function handleRemoveShare(username: string) {
    setIsSharing(true);
    setShareMessage(null);
    try {
      const nextShares = await removeListShare(list.id, list.userEmail, username);
      setShares(nextShares);
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : "Unable to remove share");
    } finally {
      setIsSharing(false);
    }
  }

  async function handleToggleShareEdit(share: ListShare) {
    if (!share.username) {
      setShareMessage("User must have a username to update sharing.");
      return;
    }
    setIsSharing(true);
    setShareMessage(null);
    try {
      const nextShares = await updateListSharePermission(
        list.id,
        list.userEmail,
        share.username,
        !share.canEdit,
      );
      setShares(nextShares);
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : "Unable to update share");
    } finally {
      setIsSharing(false);
    }
  }

  if (!isOwner && !canEditList) {
    return null;
  }

  if (!isOwner && canEditList) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-black-500">Shared with you for collaboration.</p>
        <button
          type="button"
          onClick={() => {
            const next = !isEditing;
            setIsEditing(next);
            onEditingChange?.(next);
          }}
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:brightness-95 active:brightness-90"
        >
          {isEditing ? "Stop editing" : "Edit movies"}
        </button>
      </div>
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        setMessage(null);
        const data = await apiFetch<{ list: SavedList }>(`/lists/${list.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title, slug, color, visibility }),
        });
        setTitle(data.list.title);
        setSlug(data.list.slug);
        setColor(normalizeListColor(data.list.color ?? DEFAULT_LIST_COLOR_ID));
        setVisibility(data.list.visibility);
        setMessage("Saved changes");
        setIsEditing(false);
        onEditingChange?.(false);
        const currentPath = list.username ? `/${list.username}/${list.slug}` : `/${list.slug}`;
        const nextPath = data.list.username ? `/${data.list.username}/${data.list.slug}` : `/${data.list.slug}`;
        if (nextPath !== currentPath) {
          router.replace(nextPath);
        } else {
          router.replace(currentPath);
          router.refresh();
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save");
      }
    });
  }

  if (!isEditing) {
    return (
      <div className="space-y-4">
        {message && <p className="text-xs text-black-400">{message}</p>}
        {!hideOwnerEditButton ? (
          <button
            type="button"
            onClick={() => {
              setIsEditing(true);
              onEditingChange?.(true);
            }}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:brightness-95 active:brightness-90"
          >
            Edit list
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <form className="space-y-3 p-3 sm:p-5" onSubmit={handleSubmit}>
      <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-white">Edit list</h2>
          <p className="text-sm text-black-400">{list.title}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setTitle(list.title);
            setSlug(list.slug);
            setColor(normalizeListColor(list.color ?? DEFAULT_LIST_COLOR_ID));
            setVisibility(list.visibility);
            setIsEditing(false);
            onEditingChange?.(false);
          }}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/6 text-black-200 transition hover:bg-white/12 hover:text-white active:bg-white/16"
          aria-label="Close editor"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-3 sm:p-4">
          <label className="space-y-2">
            <span className="text-[11px] uppercase tracking-[0.28em] text-black-500">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-2xl border border-white/8 bg-black/40 px-3 py-2 text-sm text-white outline-none transition placeholder:text-black-500 focus:border-white/18 focus:bg-black/55"
              aria-label="Title"
            />
          </label>

          <label className="space-y-2">
            <span className="text-[11px] uppercase tracking-[0.28em] text-black-500">Slug</span>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="w-full rounded-2xl border border-white/8 bg-black/40 px-3 py-2 text-sm text-white outline-none transition placeholder:text-black-500 focus:border-white/18 focus:bg-black/55"
              aria-label="Slug"
            />
          </label>

          <div className="rounded-xl border border-white/8 bg-black/30 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.28em] text-black-500">URL</p>
            <p className="mt-1 break-all text-sm text-black-200">
              {list.username ? `/${list.username}/${slug || "list"}` : `/${slug || "list"}`}
            </p>
          </div>
        </section>

        <section className="space-y-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-3 sm:p-4">
          <div className="rounded-xl border border-white/8 bg-black/35 p-2.5">
            <label className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <span className="text-[11px] uppercase tracking-[0.28em] text-black-500">Visibility</span>
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as SavedList["visibility"])}
                className="w-full rounded-full border border-white/10 bg-white/8 px-4 py-2.5 text-xs uppercase tracking-[0.2em] text-white outline-none transition focus:border-white/20 sm:w-auto"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </label>
            {!list.username && visibility === "public" && (
              <p className="mt-3 rounded-2xl border border-amber-200/12 bg-amber-300/8 px-3 py-2 text-[11px] leading-5 text-amber-100">
                Set a username first so your list can go public.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/8 bg-black/30 p-2.5">
            <p className="mb-2.5 text-[11px] uppercase tracking-[0.28em] text-black-500">Color</p>
            <div className="flex flex-wrap gap-2">
              {LIST_COLOR_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setColor(option.id)}
                  title={option.label}
                  aria-label={option.label}
                  aria-pressed={color === option.id}
                  style={{
                    backgroundImage: option.overlay,
                    backgroundColor: option.surface,
                    boxShadow: color === option.id
                      ? `0 0 0 2px #000, 0 0 0 4px ${option.ring}`
                      : undefined,
                  }}
                  className="h-7 w-7 rounded-full transition-all duration-150 hover:scale-110 active:scale-95"
                />
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="space-y-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={shareUsername}
            onChange={(event) => setShareUsername(event.target.value)}
            placeholder="Share with username"
            disabled={!canShare}
            className="w-full rounded-2xl border border-white/8 bg-black/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-black-500 focus:border-white/18 focus:bg-black/55 disabled:opacity-60"
            aria-label="Share with username"
          />
          <button
            type="button"
            onClick={handleAddShare}
            disabled={isSharing || !canShare}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:brightness-95 active:brightness-90 disabled:opacity-50"
          >
            {isSharing ? "Sharing..." : "Share"}
          </button>
        </div>

        {!canShare && (
          <p className="text-[11px] text-black-400">
            Set a username on your profile to share private lists.
          </p>
        )}
        {shareMessage && (
          <p className="rounded-2xl border border-white/8 bg-black/30 px-3 py-2 text-[11px] leading-5 text-black-300">
            {shareMessage}
          </p>
        )}
        {isLoadingShares ? (
          <p className="text-[11px] text-black-400">Loading shared users...</p>
        ) : shares.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-4 text-center text-[11px] text-black-500">
            No shared users yet.
          </div>
        ) : (
          <div className="space-y-2">
            {shares.map((share) => (
              <div
                key={share.userEmail}
                className="flex flex-col gap-3 rounded-[24px] border border-white/8 bg-black/35 p-3.5 text-xs text-black-200 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white">{formatShareLabel(share)}</p>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-black-500">
                    {share.canEdit ? "Can edit" : "Read only"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isSharing}
                    onClick={() => handleToggleShareEdit(share)}
                    className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[10px] font-medium text-white transition hover:bg-white/14 active:bg-white/18 disabled:opacity-50"
                  >
                    {share.canEdit ? "Revoke edits" : "Allow edits"}
                  </button>
                  {share.username ? (
                    <button
                      type="button"
                      disabled={isSharing}
                      onClick={() => handleRemoveShare(share.username ?? "")}
                      className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[10px] font-medium text-white transition hover:bg-white/14 active:bg-white/18 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="text-[10px] text-black-500">No username</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {message ? (
        <p className="rounded-2xl border border-white/8 bg-black/30 px-4 py-3 text-xs text-black-300">{message}</p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t border-white/8 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              try {
                setMessage(null);
                await apiFetch(`/lists/${list.id}`, {
                  method: "DELETE",
                });
                router.push("/");
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Unable to delete");
              }
            });
          }}
          className="w-full rounded-2xl border border-red-200/14 bg-red-300/8 px-4 py-2 text-sm font-medium text-red-100 transition hover:bg-red-300/12 active:bg-red-300/16 disabled:opacity-50 sm:w-auto"
        >
          {isPending ? "Deleting..." : "Delete list"}
        </button>

        <div className="flex flex-col gap-2 sm:flex-row">
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
              if (list.username) {
                router.replace(`/${list.username}/${list.slug}`);
              }
            }}
            className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/12 active:bg-white/16 disabled:opacity-50 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-2xl bg-white px-5 py-2 text-sm font-semibold text-black transition hover:brightness-95 active:brightness-90 disabled:opacity-50 sm:w-auto"
          >
            {isPending ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
