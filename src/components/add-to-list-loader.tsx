"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { MovieListActions } from "@/components/movie-list-actions";
import { addList, loadLists, type SavedList } from "@/lib/list-store";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";

type AddToListLoaderProps = {
  tmdbId: number;
  userEmail: string;
};

export function AddToListLoader({ tmdbId, userEmail }: AddToListLoaderProps) {
  const [lists, setLists] = useState<SavedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    loadLists(userEmail)
      .then((data) => {
        if (!active) return;
        setLists(data);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userEmail]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black-950/60 p-4">
        <p className="text-sm text-black-200">Loading your lists…</p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black-950/60 p-4">
        <p className="text-sm text-black-200">Unable to load lists.</p>
      </div>
    );
  }

  return <MovieListActions lists={lists} tmdbId={tmdbId} userEmail={userEmail} />;
}

type AddToListButtonProps = AddToListLoaderProps & {
  onExpandChange?: (expanded: boolean) => void;
  appleTvSlot?: ReactNode;
  mediaType?: "movie" | "tv";
};

export function AddToListButton({ tmdbId, userEmail, onExpandChange, appleTvSlot, mediaType = "movie" }: AddToListButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const [lists, setLists] = useState<SavedList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [selectedListId, setSelectedListId] = useState("");
  const [mode, setMode] = useState<"select" | "create">("select");
  const [newListTitle, setNewListTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [inList, setInList] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    loadLists(userEmail)
      .then((data) => {
        if (!active) return;
        setLists(data);
        setSelectedListId(data[0]?.id ?? "");
        // Movie and TV ids overlap, so membership must match on type too.
        setInList(
          data.some((list) => list.items.some((item) => item.tmdbId === tmdbId && item.mediaType === mediaType)),
        );
      })
      .catch(() => {/* silently ignore — icon defaults to + */});
    return () => { active = false; };
  }, [userEmail, tmdbId, mediaType]);

  // Focus the title field as soon as the user enters create mode.
  useEffect(() => {
    if (!expanded || mode !== "create") return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 200);
    return () => window.clearTimeout(id);
  }, [expanded, mode]);

  function handleExpand() {
    setExpanded(true);
    onExpandChange?.(true);
    if (lists.length > 0) { setMode("select"); return; }
    setLoadingLists(true);
    loadLists(userEmail)
      .then((data) => {
        setLists(data);
        setSelectedListId(data[0]?.id ?? "");
        // With no lists yet, jump straight to creating one — it's the only useful action.
        setMode(data.length ? "select" : "create");
      })
      .catch(() => setMessage("Unable to load lists"))
      .finally(() => setLoadingLists(false));
  }

  function collapse() {
    setExpanded(false);
    onExpandChange?.(false);
    setMode("select");
    setNewListTitle("");
    setMessage(null);
  }

  function handleLeftButton() {
    // From the create field, step back to the picker when lists exist; otherwise close.
    if (mode === "create" && lists.length > 0) {
      setMode("select");
      setMessage(null);
      return;
    }
    collapse();
  }

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        setMessage(null);
        if (mode === "create") {
          const title = newListTitle.trim();
          if (!title) { setMessage("Name your list"); return; }
          await addList(title, userEmail, [tmdbId], undefined, mediaType);
        } else {
          if (!selectedListId) { setMessage("Select a list first"); return; }
          await apiFetch(`/lists/${selectedListId}/items`, {
            method: "POST",
            body: JSON.stringify({ tmdbId, mediaType }),
          });
        }
        setInList(true);
        collapse();
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Unable to save");
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-center">
        <form
          onSubmit={handleAdd}
          className="relative h-11 overflow-hidden rounded-full bg-white transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ width: expanded ? '270px' : '44px', willChange: 'width', transform: 'translateZ(0)' }}
        >
          {/* + / ✓ icon — fades out instantly on expand, fades in late on collapse */}
          <button
            type="button"
            onClick={handleExpand}
            aria-label={inList ? "In a list" : "Add to list"}
            className="absolute inset-0 flex items-center justify-center text-xl font-light text-black transition-opacity duration-150"
            style={{ opacity: expanded ? 0 : 1, transitionDelay: expanded ? '0ms' : '200ms', pointerEvents: expanded ? 'none' : 'auto' }}
          >
            {inList ? "✓" : "+"}
          </button>

          {/* Expanded content — fades in after pill opens, fades out instantly on collapse */}
          <div
            className="absolute inset-0 flex items-center gap-1 px-2 transition-opacity duration-150"
            style={{ opacity: expanded ? 1 : 0, transitionDelay: expanded ? '180ms' : '0ms', pointerEvents: expanded ? 'auto' : 'none' }}
          >
            <button
              type="button"
              onClick={handleLeftButton}
              aria-label={mode === "create" && lists.length > 0 ? "Back to list picker" : "Close"}
              className="shrink-0 px-1 text-base text-black/40 transition hover:text-black"
            >
              {mode === "create" && lists.length > 0 ? "‹" : "✕"}
            </button>
            {mode === "create" ? (
              <input
                ref={inputRef}
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                maxLength={64}
                placeholder="New list name"
                aria-label="New list name"
                className="min-w-0 flex-1 bg-transparent text-center text-sm font-semibold text-black outline-none placeholder:text-black/40"
              />
            ) : (
              <select
                value={selectedListId}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setNewListTitle("");
                    setMessage(null);
                    setMode("create");
                  } else {
                    setSelectedListId(e.target.value);
                  }
                }}
                disabled={loadingLists}
                className="min-w-0 flex-1 bg-transparent text-center text-sm font-semibold text-black outline-none"
              >
                {loadingLists
                  ? <option>Loading…</option>
                  : <>
                      <option value="">Pick a list</option>
                      {lists.map((list) => (
                        <option key={list.id ?? list.slug} value={list.id ?? ""} disabled={!list.id}>
                          {list.title}
                        </option>
                      ))}
                      <option value="__new__">+ New list</option>
                    </>
                }
              </select>
            )}
            <button
              type="submit"
              disabled={isPending || loadingLists}
              className="shrink-0 px-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              {isPending ? "…" : mode === "create" ? "Create" : "Add"}
            </button>
          </div>
        </form>

        {appleTvSlot}
      </div>

      {message ? <p className="text-xs text-neutral-400">{message}</p> : null}
    </div>
  );
}
