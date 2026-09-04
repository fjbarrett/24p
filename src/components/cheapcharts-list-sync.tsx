"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CHEAPCHARTS_API_BASE,
  CHEAPCHARTS_COUNTRIES,
  type CheapChartsCountry,
  type CheapChartsListIntegration,
} from "@/lib/cheapcharts";
import { apiFetch } from "@/lib/api-client";

type CheapChartsLoginResponse = {
  status?: string;
  message?: string;
  additionalInfo?: { sessionToken?: string };
};

async function signInToCheapCharts(email: string, password: string, country: CheapChartsCountry) {
  const response = await fetch(`${CHEAPCHARTS_API_BASE}/Account.php`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      country,
      action: "login",
      email,
      password,
      origin: "website",
      appEntity: "cc_main_website",
    }),
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error("CheapCharts sign-in is unavailable");
  const payload = (await response.json()) as CheapChartsLoginResponse;
  const sessionToken = payload.additionalInfo?.sessionToken?.trim();
  if (payload.status !== "success" || !sessionToken) {
    throw new Error(payload.message?.slice(0, 160) || "CheapCharts sign-in failed");
  }
  return sessionToken;
}

export function CheapChartsListSync({ listId }: { listId: string }) {
  const [integration, setIntegration] = useState<CheapChartsListIntegration | null>(null);
  const [country, setCountry] = useState<CheapChartsCountry>("us");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedListId, setSelectedListId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const loadIntegration = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ integration: CheapChartsListIntegration }>(`/lists/${listId}/cheapcharts`);
      setIntegration(data.integration);
      setCountry(data.integration.country);
      setSelectedListId(data.integration.link?.id ?? "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load CheapCharts settings");
    } finally {
      setIsLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    void loadIntegration();
  }, [loadIntegration]);

  async function handleConnect() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setMessage("Enter your CheapCharts email and password.");
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      // The password goes from the browser straight to CheapCharts. Only its
      // resulting session token is sent to 24p and encrypted server-side.
      const sessionToken = await signInToCheapCharts(normalizedEmail, password, country);
      await apiFetch("/integrations/cheapcharts", {
        method: "PUT",
        body: JSON.stringify({ sessionToken, country }),
      });
      setEmail("");
      setPassword("");
      setMessage("CheapCharts connected. Choose a movie list below.");
      await loadIntegration();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to connect CheapCharts");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLink() {
    if (!selectedListId) {
      setMessage("Choose a CheapCharts movie list.");
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const data = await apiFetch<{ integration: CheapChartsListIntegration }>(`/lists/${listId}/cheapcharts`, {
        method: "PUT",
        body: JSON.stringify({ cheapChartsListId: selectedListId }),
      });
      setIntegration(data.integration);
      setMessage("CheapCharts sync is on for new films added to this list.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to link CheapCharts list");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUnlink() {
    setIsSaving(true);
    setMessage(null);
    try {
      const data = await apiFetch<{ integration: CheapChartsListIntegration }>(`/lists/${listId}/cheapcharts`, {
        method: "DELETE",
      });
      setIntegration(data.integration);
      setSelectedListId("");
      setMessage("CheapCharts sync is off for this list.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to turn off CheapCharts sync");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisconnect() {
    setIsSaving(true);
    setMessage(null);
    try {
      await apiFetch("/integrations/cheapcharts", { method: "DELETE" });
      setIntegration({ connected: false, country, availableLists: [], link: null, loadError: null });
      setSelectedListId("");
      setConfirmingDisconnect(false);
      setMessage("CheapCharts disconnected from 24p.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to disconnect CheapCharts");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-3 sm:p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-white">CheapCharts</h3>
          <p className="mt-1 text-[11px] leading-5 text-black-400">
            Optionally mirror new films from this list into one CheapCharts custom movie list.
          </p>
        </div>
        {integration?.link ? (
          <span className="rounded-full border border-emerald-200/12 bg-emerald-300/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100">
            Sync on
          </span>
        ) : null}
      </div>

      {isLoading ? <p className="text-[11px] text-black-400">Loading CheapCharts settings…</p> : null}

      {!isLoading && integration && !integration.connected ? (
        <div
          className="space-y-3 rounded-xl border border-white/8 bg-black/30 p-3"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleConnect();
            }
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="CheapCharts email"
              autoComplete="username"
              className="w-full rounded-2xl border border-white/8 bg-black/40 px-3 py-2 text-sm text-white outline-none transition placeholder:text-black-500 focus:border-white/18"
              aria-label="CheapCharts email"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="CheapCharts password"
              autoComplete="current-password"
              className="w-full rounded-2xl border border-white/8 bg-black/40 px-3 py-2 text-sm text-white outline-none transition placeholder:text-black-500 focus:border-white/18"
              aria-label="CheapCharts password"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={country}
              onChange={(event) => setCountry(event.target.value as CheapChartsCountry)}
              className="w-full rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-xs text-white outline-none sm:w-auto"
              aria-label="CheapCharts store country"
            >
              {CHEAPCHARTS_COUNTRIES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleConnect()}
              disabled={isSaving}
              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:brightness-95 disabled:opacity-50"
            >
              {isSaving ? "Connecting…" : "Connect CheapCharts"}
            </button>
          </div>
          <p className="text-[10px] leading-4 text-black-500">
            Your password is sent directly from this browser to CheapCharts and never reaches 24p. 24p stores only their encrypted session token.
          </p>
        </div>
      ) : null}

      {!isLoading && integration?.connected ? (
        <div className="space-y-3 rounded-xl border border-white/8 bg-black/30 p-3">
          {integration.loadError ? (
            <p className="rounded-xl border border-amber-200/12 bg-amber-300/8 px-3 py-2 text-[11px] leading-5 text-amber-100">
              {integration.loadError}
            </p>
          ) : null}
          {integration.availableLists.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedListId}
                onChange={(event) => setSelectedListId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-white outline-none"
                aria-label="CheapCharts movie list"
              >
                <option value="">Choose a CheapCharts list</option>
                {integration.availableLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.title}{typeof list.itemCount === "number" ? ` (${list.itemCount})` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleLink()}
                disabled={isSaving || !selectedListId}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:brightness-95 disabled:opacity-50"
              >
                {isSaving ? "Saving…" : integration.link ? "Update sync" : "Turn on sync"}
              </button>
            </div>
          ) : !integration.loadError ? (
            <p className="text-[11px] leading-5 text-black-300">
              No custom movie lists found. Create one on{" "}
              <a href={`https://www.cheapcharts.com/${integration.country}`} target="_blank" rel="noreferrer" className="text-white underline underline-offset-2">
                CheapCharts
              </a>
              , then reload this editor.
            </p>
          ) : null}

          {integration.link ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
              <p className="text-xs text-white">Linked to {integration.link.title}</p>
              <p className="mt-1 text-[10px] leading-4 text-black-500">
                Only new movie additions sync. Existing films and removals are not mirrored.
              </p>
              {integration.link.lastSyncError ? (
                <p className="mt-2 text-[11px] leading-5 text-amber-100">Last sync: {integration.link.lastSyncError}</p>
              ) : integration.link.lastSyncedAt ? (
                <p className="mt-2 text-[10px] text-black-500">
                  Last synced {new Date(integration.link.lastSyncedAt).toLocaleString()}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleUnlink()}
                disabled={isSaving}
                className="mt-2 text-[11px] text-black-300 underline underline-offset-2 hover:text-white disabled:opacity-50"
              >
                Turn off for this list
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-white/8 pt-3">
            <button
              type="button"
              onClick={() => void loadIntegration()}
              disabled={isSaving}
              className="text-[11px] text-black-300 underline underline-offset-2 hover:text-white disabled:opacity-50"
            >
              Reload lists
            </button>
            {confirmingDisconnect ? (
              <>
                <span className="text-[11px] text-black-300">Disconnect every linked 24p list?</span>
                <button type="button" onClick={() => void handleDisconnect()} disabled={isSaving} className="text-[11px] text-red-200 underline underline-offset-2 disabled:opacity-50">
                  Confirm disconnect
                </button>
                <button type="button" onClick={() => setConfirmingDisconnect(false)} className="text-[11px] text-black-300 underline underline-offset-2 hover:text-white">
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmingDisconnect(true)} className="text-[11px] text-black-400 underline underline-offset-2 hover:text-white">
                Disconnect CheapCharts
              </button>
            )}
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="rounded-xl border border-white/8 bg-black/30 px-3 py-2 text-[11px] leading-5 text-black-300" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
