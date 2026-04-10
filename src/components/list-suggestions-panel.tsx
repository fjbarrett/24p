"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { SimplifiedMovie } from "@/lib/tmdb";
import { apiFetch } from "@/lib/api-client";

type Props = {
  listId: string;
};

type PanelState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; movies: SimplifiedMovie[]; added: Set<number> };

export function ListSuggestionsPanel({ listId }: Props) {
  const router = useRouter();
  const [panel, setPanel] = useState<PanelState>({ status: "idle" });

  const load = useCallback(async () => {
    setPanel({ status: "loading" });
    try {
      const { movies } = await apiFetch<{ movies: SimplifiedMovie[] }>(`/lists/${listId}/recommendations`);
      setPanel({ status: "loaded", movies, added: new Set() });
    } catch (err) {
      setPanel({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load suggestions",
      });
    }
  }, [listId]);

  const add = useCallback(
    async (tmdbId: number) => {
      // Optimistically remove from suggestions
      setPanel((prev) => {
        if (prev.status !== "loaded") return prev;
        return { ...prev, added: new Set([...prev.added, tmdbId]) };
      });
      try {
        await apiFetch(`/lists/${listId}/items`, {
          method: "POST",
          body: JSON.stringify({ tmdbId }),
        });
        router.refresh();
      } catch {
        // Revert on failure
        setPanel((prev) => {
          if (prev.status !== "loaded") return prev;
          const reverted = new Set(prev.added);
          reverted.delete(tmdbId);
          return { ...prev, added: reverted };
        });
      }
    },
    [listId, router],
  );

  const dismiss = useCallback(() => setPanel({ status: "idle" }), []);

  if (panel.status === "idle") {
    return (
      <div className="flex justify-center">
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/50 transition hover:border-white/20 hover:text-white/80"
        >
          <SparkleIcon />
          Suggest more
        </button>
      </div>
    );
  }

  if (panel.status === "loading") {
    return (
      <div className="flex justify-center py-4">
        <span className="text-sm text-white/40">Finding suggestions…</span>
      </div>
    );
  }

  if (panel.status === "error") {
    return (
      <div className="flex items-center justify-center gap-3 py-2">
        <span className="text-sm text-white/40">{panel.message}</span>
        <button
          onClick={load}
          className="text-sm text-white/60 underline underline-offset-2 hover:text-white/90"
        >
          Try again
        </button>
      </div>
    );
  }

  const visible = panel.movies.filter((m) => !panel.added.has(m.tmdbId));

  return (
    <div className="rounded-2xl border border-white/5 bg-black-950/60 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-white/60">
          <SparkleIcon />
          Suggested additions
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="text-xs text-white/30 transition hover:text-white/60"
          >
            Refresh
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss suggestions"
            className="text-white/30 transition hover:text-white/70"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-2 text-sm text-white/40">All suggestions added.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          {visible.map((movie) => (
            <SuggestionCard key={movie.tmdbId} movie={movie} onAdd={() => add(movie.tmdbId)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SuggestionCard({ movie, onAdd }: { movie: SimplifiedMovie; onAdd: () => void }) {
  return (
    <li className="group">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-black-900/40">
        {movie.posterUrl ? (
          <Image
            src={toSmallPoster(movie.posterUrl)}
            alt={`${movie.title} poster`}
            fill
            sizes="(max-width: 640px) 30vw, (max-width: 1024px) 22vw, 140px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-black-800 text-[10px] text-black-500">
            No art
          </div>
        )}
        {/* Add button — always visible on mobile, revealed on hover on desktop */}
        <button
          onClick={onAdd}
          aria-label={`Add ${movie.title} to list`}
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-white hover:text-black sm:opacity-0 sm:group-hover:opacity-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
          </svg>
        </button>
      </div>
      <p className="mt-1 truncate text-xs text-white/70">{movie.title}</p>
      {movie.releaseYear ? <p className="text-[10px] text-white/40">{movie.releaseYear}</p> : null}
    </li>
  );
}

function SparkleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828l.645-1.937ZM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.734 1.734 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.734 1.734 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.734 1.734 0 0 0 3.407 2.31l.387-1.162ZM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L10.863.1Z" />
    </svg>
  );
}

function toSmallPoster(url: string): string {
  return url.includes("/w500/")
    ? url.replace("/w500/", "/w185/")
    : url.includes("/w342/")
      ? url.replace("/w342/", "/w185/")
      : url;
}
