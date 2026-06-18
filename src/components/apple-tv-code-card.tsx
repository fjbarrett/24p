"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type TvDevice = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

function lastUsedLabel(device: TvDevice) {
  const iso = device.lastUsedAt ?? device.createdAt;
  const date = new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return device.lastUsedAt ? `Last used ${date}` : `Paired ${date} · not used yet`;
}

export function AppleTvCodeCard() {
  const [pin, setPin] = useState<string | null>(null);
  const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [devices, setDevices] = useState<TvDevice[]>([]);
  const [isPending, startTransition] = useTransition();

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/tv/token");
      if (!res.ok) return;
      const body = (await res.json()) as { tokens?: TvDevice[] };
      setDevices(body.tokens ?? []);
    } catch {
      // Non-fatal: the device list is informational.
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

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
        const body = (await res.json()) as { pin: string; expiresInSeconds?: number };
        setPin(body.pin);
        setExpiresInSeconds(body.expiresInSeconds ?? null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to create a code.");
      }
    });
  };

  const removeDevice = (id: string) => {
    if (isPending) return;
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch(`/api/tv/token?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        setMessage("Device removed. That Apple TV will be signed out.");
        await loadDevices();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to remove device.");
      }
    });
  };

  const revoke = () => {
    if (isPending) return;
    startTransition(async () => {
      setMessage(null);
      setPin(null);
      setCopied(false);
      try {
        const res = await fetch("/api/tv/token", { method: "DELETE" });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        setMessage("All Apple TV codes revoked. Any signed-in Apple TV will be signed out.");
        await loadDevices();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to revoke codes.");
      }
    });
  };

  const copy = async () => {
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const expiryLabel =
    expiresInSeconds && expiresInSeconds > 0 ? `Expires in ${Math.round(expiresInSeconds / 60)} minutes.` : "";

  return (
    <section className="space-y-4 rounded-[20px] border border-white/8 bg-white/[0.03] p-3 sm:p-4">
      <span className="text-[11px] uppercase tracking-[0.28em] text-black-500">Apple TV</span>

      <div className="space-y-0.5">
        <p className="text-sm font-medium text-white">Sign in on Apple TV</p>
        <p className="text-sm text-black-400">
          Generate a 4-digit code, then enter it on the 24p Apple TV app&rsquo;s Sign In screen to access your account.
        </p>
      </div>

      {pin ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/12 bg-black/40 px-4 py-4 text-center">
            <p className="font-mono text-5xl tracking-[0.4em] text-white">{pin}</p>
          </div>
          <p className="text-xs text-black-400">
            Enter this on your Apple TV now. {expiryLabel} It can only be used once.
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
              onClick={() => setPin(null)}
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

      {devices.length > 0 && (
        <>
          <div className="border-t border-white/6" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-white">Signed-in devices</p>
            <ul className="space-y-2">
              {devices.map((device) => (
                <li
                  key={device.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{device.label}</p>
                    <p className="text-xs text-black-400">{lastUsedLabel(device)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDevice(device.id)}
                    disabled={isPending}
                    className="shrink-0 rounded-lg border border-white/10 bg-white/6 px-2.5 py-1 text-xs font-medium text-black-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
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
