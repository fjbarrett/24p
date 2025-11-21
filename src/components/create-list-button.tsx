"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function CreateListButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("Saturday Double Feature");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        const response = await fetch("/api/lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? "Unable to save list");
        }
        setIsOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
      }
    });
  }

  return (
    <div className="text-center">
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center rounded-full border border-slate-500 px-6 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
      >
        Create new list
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 text-left shadow-2xl">
            <h3 className="text-xl font-semibold text-white">Name your list</h3>
            <p className="mt-1 text-sm text-slate-400">We will use this to generate the shareable slug.</p>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <label className="text-sm text-slate-300">
                Title
                <input
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-400 focus:outline-none"
                  maxLength={64}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-400"
                >
                  Cancel
                </button>
                {error && <p className="text-xs text-rose-300">{error}</p>}
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save title"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
