"use client";

import { useState, useTransition } from "react";

type ImportListFormProps = {
  onComplete?: () => void;
};

export function ImportListForm({ onComplete }: ImportListFormProps) {
  const [title, setTitle] = useState("Imported list");
  const [raw, setRaw] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/lists/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, data: raw }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage(data.error ?? "Unable to import lists");
        return;
      }
      setRaw("");
      setMessage("Import complete");
      onComplete?.();
      window.location.reload();
    });
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-black-900/40 p-6 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-black-400">Import</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Bring in Letterboxd or IMDb lists</h2>
        <p className="text-sm text-black-400">Paste CSV text or newline titles; we will match them on TMDB.</p>
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
          />
        </label>
        {message && <p className="text-xs text-black-400">{message}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full border border-black-500 px-4 py-2 text-sm text-black-100 transition hover:bg-black-800 disabled:opacity-50"
        >
          {isPending ? "Importing..." : "Import list"}
        </button>
      </form>
    </section>
  );
}
