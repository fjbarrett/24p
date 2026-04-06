"use client";

import { useState, useTransition } from "react";
import { apiFetch } from "@/lib/api-client";

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
        await apiFetch("/lists/import", {
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
    <form className="space-y-4" onSubmit={handleSubmit} aria-describedby={message ? "import-status" : undefined}>
      <section className="space-y-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-3 sm:p-4">
        <label className="space-y-2">
          <span className="text-[11px] uppercase tracking-[0.28em] text-black-500">List title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-2xl border border-white/8 bg-black/40 px-3 py-2 text-sm text-white outline-none transition placeholder:text-black-500 focus:border-white/18 focus:bg-black/55"
          />
        </label>

        <label className="space-y-2">
          <span className="text-[11px] uppercase tracking-[0.28em] text-black-500">Paste export</span>
          <textarea
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            rows={6}
            className="w-full rounded-2xl border border-white/8 bg-black/40 px-3 py-2 text-sm text-white outline-none transition placeholder:text-black-500 focus:border-white/18 focus:bg-black/55"
            placeholder={"Title,Year\nInception,2010"}
          />
        </label>
      </section>

      {message && (
        <p className="rounded-2xl border border-white/8 bg-black/30 px-4 py-3 text-xs text-black-300" id="import-status" role="status" aria-live="polite">
          {message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-white/8 pt-3 sm:flex-row sm:justify-end">
        <button
          type="submit"
          disabled={isPending || !userEmail}
          className="w-full rounded-2xl bg-white px-5 py-2 text-sm font-semibold text-black transition hover:brightness-95 active:brightness-90 disabled:opacity-50 sm:w-auto"
        >
          {isPending ? "Importing..." : "Import list"}
        </button>
      </div>
    </form>
  );
}
