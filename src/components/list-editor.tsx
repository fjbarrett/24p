"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ListShare, SavedList } from "@/lib/list-store";
import { addListShare, loadListShares, removeListShare, updateListSharePermission } from "@/lib/list-store";
import { DEFAULT_LIST_COLOR_ID, normalizeListColor } from "@/lib/list-colors";
import { rustApiFetch } from "@/lib/rust-api-client";

export function ListEditor({
  list,
  viewerEmail,
  canEdit,
  onEditingChange,
}: {
  list: SavedList;
  viewerEmail?: string | null;
  canEdit?: boolean;
  onEditingChange?: (isEditing: boolean) => void;
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
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();
  const listPath = list.username ? `/${list.username}/${slug}` : `/${slug}`;
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

  if (!isOwner && canEditList) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-black-300" style={{ paddingLeft: 16 }}>
          {listPath}
        </p>
        <p className="text-xs text-black-500" style={{ paddingLeft: 16 }}>
          Shared with you for collaboration.
        </p>
        <button
          type="button"
          onClick={() => {
            const next = !isEditing;
            setIsEditing(next);
            onEditingChange?.(next);
          }}
          className="rounded-full px-4 py-2 text-sm text-white/60 transition hover:bg-white/8 hover:text-white"
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
        const data = await rustApiFetch<{ list: SavedList }>(`/lists/${list.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title, slug, color, visibility, userEmail: list.userEmail }),
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
        <p className="text-sm text-black-300" style={{ paddingLeft: 16 }}>{listPath}</p>
        {message && <p className="text-xs text-black-400" style={{ paddingLeft: 16 }}>{message}</p>}
        <button
          type="button"
          onClick={() => {
            setIsEditing(true);
            onEditingChange?.(true);
          }}
          className="rounded-full px-4 py-2 text-sm text-white/60 transition hover:bg-white/8 hover:text-white"
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
        className="w-full rounded-2xl border border-black-700 bg-black-950 px-3 py-2 text-sm text-black-100"
        aria-label="Title"
      />
      <input
        value={slug}
        onChange={(event) => setSlug(event.target.value)}
        className="w-full rounded-2xl border border-black-700 bg-black-950 px-3 py-2 text-sm text-black-100"
        aria-label="Slug"
      />
      <div className="rounded-2xl border border-black-700 bg-black-950 px-3 py-2 text-sm text-black-200">
        <label className="flex items-center justify-between gap-4">
          <span className="text-xs uppercase tracking-[0.3em] text-black-400">Visibility</span>
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as SavedList["visibility"])}
            className="rounded-full border border-black-700 bg-black-950 px-3 py-1 text-xs uppercase tracking-[0.2em] text-black-100"
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </label>
        {!list.username && visibility === "public" && (
          <p className="mt-2 text-[11px] text-black-400">
            Set a username first so your list can go public.
          </p>
        )}
      </div>
      <div className="rounded-2xl border border-black-700 bg-black-950 px-3 py-3 text-sm text-black-200 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs uppercase tracking-[0.3em] text-black-400">Shared access</span>
          <span className="text-[11px] text-black-400">Private lists stay off the public directory.</span>
        </div>
        <div className="flex gap-2">
          <input
            value={shareUsername}
            onChange={(event) => setShareUsername(event.target.value)}
            placeholder="Share with username"
            disabled={!canShare}
            className="w-full rounded-full border border-black-700 bg-black-950 px-3 py-2 text-xs text-black-100 disabled:opacity-60"
            aria-label="Share with username"
          />
          <button
            type="button"
            onClick={handleAddShare}
            disabled={isSharing || !canShare}
            className="rounded-full border border-white/15 px-3 py-2 text-xs text-white/70 transition hover:bg-white/5 disabled:opacity-50"
          >
            {isSharing ? "Sharing..." : "Share"}
          </button>
        </div>
        {!canShare && (
          <p className="text-[11px] text-black-400">
            Set a username on your profile to share private lists.
          </p>
        )}
        {shareMessage && <p className="text-[11px] text-black-400">{shareMessage}</p>}
        {isLoadingShares ? (
          <p className="text-[11px] text-black-400">Loading shared users...</p>
        ) : shares.length === 0 ? (
          <p className="text-[11px] text-black-500">No shared users yet.</p>
        ) : (
          <div className="space-y-2">
            {shares.map((share) => (
              <div key={share.userEmail} className="flex items-center justify-between text-xs text-black-200">
                <div>
                  <p>{formatShareLabel(share)}</p>
                  <p className="text-[10px] text-black-500">{share.canEdit ? "Can edit" : "Read only"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSharing}
                    onClick={() => handleToggleShareEdit(share)}
                    className="rounded-full border border-white/15 px-2 py-1 text-[10px] text-white/60 transition hover:bg-white/5 disabled:opacity-50"
                  >
                    {share.canEdit ? "Revoke edits" : "Allow edits"}
                  </button>
                  {share.username ? (
                    <button
                      type="button"
                      disabled={isSharing}
                      onClick={() => handleRemoveShare(share.username ?? "")}
                      className="rounded-full border border-white/15 px-2 py-1 text-[10px] text-white/60 transition hover:bg-white/5 disabled:opacity-50"
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
      </div>
      {message && <p className="text-xs text-black-400">{message}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-[#0085ff] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0070d9] disabled:opacity-50"
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
          className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5 disabled:opacity-50"
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
          className="rounded-full border border-rose-500/40 px-4 py-2 text-sm text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-50"
        >
          {isPending ? "Deleting..." : "Delete list"}
        </button>
      </div>
    </form>
  );
}
