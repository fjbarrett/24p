"use client";

import { useState, useTransition } from "react";

export function AppleTvCodeCard() {
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const generate = () => {
    if (isPending) return;
    startTransition(async () => {
      setMessage(null);
      setCopied(false);
      try {
        const res = await fetch("/api/tv/token", { method: "POST" });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        const body = (await res.json()) as { token: string };
        setToken(body.token);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to create a code.");
      }
    });
  };

  const revoke = () => {
    if (isPending) return;
    startTransition(async () => {
      setMessage(null);
      setToken(null);
      setCopied(false);
      try {
        const res = await fetch("/api/tv/token", { method: "DELETE" });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        setMessage("All Apple TV codes revoked. Any signed-in Apple TV will be signed out.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to revoke codes.");
      }
    });
  };

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="space-y-4 rounded-[20px] border border-white/8 bg-white/[0.03] p-3 sm:p-4">
      <span className="text-[11px] uppercase tracking-[0.28em] text-black-500">Apple TV</span>

      <div className="space-y-0.5">
        <p className="text-sm font-medium text-white">Sign in on Apple TV</p>
        <p className="text-sm text-black-400">
          Generate a one-time code, then enter it on the 24p Apple TV app&rsquo;s Sign In screen to access your account.
        </p>
      </div>

      {token ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-center">
            <p className="font-mono text-2xl tracking-[0.3em] text-white">{token}</p>
          </div>
          <p className="text-xs text-black-400">
            Enter this on your Apple TV now — it won&rsquo;t be shown again. Keep it private; anyone with the code can access your account.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded-xl border border-white/20 bg-white/14 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/20"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setToken(null)}
              className="rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm font-medium text-black-300 transition hover:bg-white/10 hover:text-white"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={isPending}
          className="rounded-xl border border-white/20 bg-white/14 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
        >
          {isPending ? "Generating…" : "Generate code"}
        </button>
      )}

      <div className="border-t border-white/6" />

      <div className="space-y-2">
        <p className="text-sm text-black-400">Signed in on an Apple TV you no longer have? Revoke all codes.</p>
        <button
          type="button"
          onClick={revoke}
          disabled={isPending}
          className="rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm font-medium text-black-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          Revoke all Apple TV codes
        </button>
      </div>

      {message && (
        <p className="rounded-2xl border border-white/8 bg-black/30 px-4 py-3 text-xs text-black-300">{message}</p>
      )}
    </section>
  );
}
