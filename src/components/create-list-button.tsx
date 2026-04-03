"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rustApiFetch } from "@/lib/rust-api-client";

export function CreateListButton({ userEmail }: { userEmail: string }) {
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
        const email = userEmail.trim().toLowerCase();
        if (!email) {
          setError("Sign in to create lists");
          return;
        }
        await rustApiFetch("/lists", {
          method: "POST",
          body: JSON.stringify({ title, userEmail: email }),
        });
        setIsOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
      }
    });
  }

  return (
    <div className="w-full">
      <button
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-base font-semibold text-black transition hover:brightness-95 active:brightness-90"
      >
        +
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-list-title"
          aria-describedby="create-list-desc"
        >
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black p-6 text-left shadow-2xl">
            <h3 className="text-xl font-semibold text-white" id="create-list-title">
              Name your list
            </h3>
            <p className="mt-1 text-sm text-black-400" id="create-list-desc">
              We will use this to generate the shareable slug.
            </p>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <label className="text-sm text-black-300">
                Title
                <input
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-black-700 bg-black-950 px-3 py-2 text-base text-black-100 focus:border-black-400 focus:outline-none"
                  maxLength={64}
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                {error && <p className="text-xs text-rose-300">{error}</p>}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full bg-white px-4 py-2 text-base font-medium text-black transition hover:brightness-95 active:brightness-90"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-full bg-white px-4 py-2 text-base font-semibold text-black transition hover:brightness-95 active:brightness-90 disabled:opacity-50"
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
