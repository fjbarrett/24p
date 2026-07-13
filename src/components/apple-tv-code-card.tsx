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
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
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

  const approve = () => {
    if (isPending || code.length !== 6) return;
    startTransition(async () => {
      setMessage(null);
      setApproved(false);
      try {
        const res = await fetch("/api/tv/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: code }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        setApproved(true);
        setCode("");
        setMessage("Device approved. It will finish signing in on its own within a few seconds.");
        await loadDevices();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to approve the device.");
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
        setMessage("Device removed. It will be signed out.");
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
      try {
        const res = await fetch("/api/tv/token", { method: "DELETE" });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        setMessage("All devices revoked. Any signed-in Apple TV, iPhone, or iPad will be signed out.");
        await loadDevices();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to revoke devices.");
      }
    });
  };

  return (
    <section className="space-y-4 rounded-[20px] border border-white/8 bg-white/[0.03] p-3 sm:p-4">
      <span className="text-[11px] uppercase tracking-[0.28em] text-black-500">Apple devices</span>

      <div className="space-y-0.5">
        <p className="text-sm font-medium text-white">Sign in on Apple TV, iPhone, or iPad</p>
        <p className="text-sm text-black-400">
          Open the 24p app on your device and choose Sign In. It will show a 6-digit code — enter it here to
          approve the device.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          approve();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          aria-label="6-digit device code"
          className="w-40 rounded-xl border border-white/12 bg-black/40 px-3 py-1.5 text-center font-mono text-lg tracking-[0.3em] text-white placeholder:text-black-600 focus:border-white/30 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending || code.length !== 6}
          className="rounded-xl border border-white/20 bg-white/14 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
        >
          {isPending ? "Approving…" : "Approve"}
        </button>
      </form>

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
        <p className="text-sm text-black-400">Signed in on a device you no longer have? Revoke everything.</p>
        <button
          type="button"
          onClick={revoke}
          disabled={isPending}
          className="rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-sm font-medium text-black-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          Revoke all devices
        </button>
      </div>

      {message && (
        <p
          className={`rounded-2xl border px-4 py-3 text-xs ${
            approved ? "border-white/12 bg-white/6 text-white" : "border-white/8 bg-black/30 text-black-300"
          }`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
