"use client";

import Image from "next/image";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { StreamingPlatform } from "@/lib/server/justwatch";

type StreamingDiscoveryControlsProps = {
  providers: StreamingPlatform[];
  selectedProviders: string[];
  selectedSort: string;
};

const STREAMING_PREFERENCES_KEY = "streaming:preferences";

type StreamingPreferences = {
  providers: string[];
  sort: string;
};

export function StreamingDiscoveryControls({
  providers,
  selectedProviders,
  selectedSort,
}: StreamingDiscoveryControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const providerKey = providers.map((provider) => provider.shortName).join(",");

  function updateQuery(nextProviders: string[], nextSort: string, nextSeed?: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextProviders.length) params.set("provider", nextProviders.join(","));
    else params.delete("provider");

    if (nextSort && nextSort !== "popularity") params.set("sort", nextSort);
    else params.delete("sort");

    if (nextSeed) params.set("seed", nextSeed);

    params.delete("page");

    router.replace(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    try {
      const payload: StreamingPreferences = {
        providers: selectedProviders,
        sort: selectedSort,
      };
      window.localStorage.setItem(STREAMING_PREFERENCES_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }, [selectedProviders, selectedSort]);

  useEffect(() => {
    const hasProviderParam = searchParams.has("provider");
    const hasSortParam = searchParams.has("sort");
    if (hasProviderParam && hasSortParam) return;

    try {
      const raw = window.localStorage.getItem(STREAMING_PREFERENCES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<StreamingPreferences> | string[];
      const parsedProviders = Array.isArray(parsed) ? parsed : parsed.providers;
      const parsedSort = Array.isArray(parsed) ? null : parsed.sort;
      if (!Array.isArray(parsedProviders)) return;

      const allowed = new Set(providers.map((provider) => provider.shortName));
      const restoredProviders = parsedProviders.filter(
        (value, index) =>
          typeof value === "string" &&
          allowed.has(value) &&
          parsedProviders.indexOf(value) === index,
      ) as string[];
      const restoredSort = parsedSort === "rating" ? "rating" : "popularity";

      const nextProviders = hasProviderParam ? selectedProviders : restoredProviders;
      const nextSort = hasSortParam ? selectedSort : restoredSort;
      const providersChanged = nextProviders.join(",") !== selectedProviders.join(",");
      const sortChanged = nextSort !== selectedSort;

      if (!providersChanged && !sortChanged) return;
      updateQuery(nextProviders, nextSort, searchParams.get("seed") ?? Date.now().toString());
    } catch {
      // ignore storage errors
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- restore only when URL/provider state changes, not on every function recreation
  }, [providerKey, providers, searchParams, selectedProviders, selectedSort]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => updateQuery([], selectedSort, Date.now().toString())}
        aria-pressed={selectedProviders.length === 0}
        className={`rounded-full border px-3 py-1.5 text-xs transition ${
          selectedProviders.length === 0
            ? "border-white/30 bg-white/10 text-white"
            : "border-white/10 text-white/60 hover:border-white/20 hover:text-white"
        }`}
      >
        All
      </button>
      {providers.map((provider) => {
        const active = selectedProviders.includes(provider.shortName);
        const nextProviders = active
          ? selectedProviders.filter((value) => value !== provider.shortName)
          : [...selectedProviders, provider.shortName];

        return (
          <button
            key={provider.shortName}
            type="button"
            onClick={() => updateQuery(nextProviders, selectedSort, Date.now().toString())}
            aria-pressed={active}
            aria-label={active ? `Remove ${provider.name} filter` : `Filter by ${provider.name}`}
            title={provider.name}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
              active
                ? "border-white/30 bg-white/12 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                : "border-white/10 bg-black/40 opacity-55 hover:border-white/20 hover:bg-white/[0.05] hover:opacity-80"
            }`}
          >
            {provider.iconUrl ? (
              <Image
                src={provider.iconUrl}
                alt={provider.name}
                width={24}
                height={24}
                className="h-6 w-6 rounded-md object-cover"
                unoptimized
              />
            ) : (
              <span className="text-[10px] text-white/70">{provider.name.slice(0, 2).toUpperCase()}</span>
            )}
          </button>
        );
      })}
      <select
        value={selectedSort}
        onChange={(event) => updateQuery(selectedProviders, event.target.value, Date.now().toString())}
        className="rounded-2xl bg-transparent px-3 py-2 text-sm text-white outline-none transition hover:bg-white/10"
      >
        <option value="popularity">Popularity</option>
        <option value="rating">IMDb Rating</option>
      </select>
    </div>
  );
}
