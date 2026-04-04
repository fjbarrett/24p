"use client";

import { useState, useTransition } from "react";
import { rustApiFetch } from "@/lib/rust-api-client";

type ImportListFormProps = {
  userEmail?: string | null;
  onComplete?: () => void;
};

export function ImportListForm({ userEmail, onComplete }: ImportListFormProps) {
  const [title, setTitle] = useState("Imported list");
  const [raw, setRaw] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setMessage(null);
      const email = userEmail?.trim().toLowerCase() ?? "";
      if (!email) {
        setMessage("Sign in to import lists.");
        return;
      }

      try {
        await rustApiFetch("/lists/import", {
          method: "POST",
          body: JSON.stringify({ title, data: raw }),
        });
        setRaw("");
        setMessage("Import complete");
        onComplete?.();
        window.location.reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to import lists");
      }
    });
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-black-900/40 p-6 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-black-400">Import</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Bring in Letterboxd or IMDb lists</h2>
        <p className="text-sm text-black-400" id="import-help">
          Paste CSV text (including exports from this page) or newline titles; we will match them on TMDB.
        </p>
      </div>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="text-sm text-black-300">
          List title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-black-700 bg-black-950 px-3 py-2 text-sm text-black-100"
          />
        </label>
        <label className="text-sm text-black-300">
          Paste export
          <textarea
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            rows={6}
            className="mt-1 w-full rounded-2xl border border-black-700 bg-black-950 px-3 py-2 text-sm text-black-100"
            placeholder="Title,Year\nInception,2010"
            aria-describedby={["import-help", message ? "import-status" : null].filter(Boolean).join(" ")}
          />
        </label>
        {message && (
          <p className="text-xs text-black-400" id="import-status" role="status" aria-live="polite">
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending || !userEmail}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:brightness-95 active:brightness-90 disabled:opacity-50"
        >
          {isPending ? "Importing..." : "Import list"}
        </button>
      </form>
    </section>
  );
}
