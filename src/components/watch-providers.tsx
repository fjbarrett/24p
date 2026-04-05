"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
type WatchProvidersData = {
  providers: { id: number; name: string; logoUrl: string }[];
  justWatchLink: string | null;
};

export function WatchProviders({ tmdbId }: { tmdbId: number }) {
  const [data, setData] = useState<WatchProvidersData | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/watch-providers?tmdbId=${tmdbId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (active && json) setData(json as WatchProvidersData); })
      .catch(() => {});
    return () => { active = false; };
  }, [tmdbId]);

  if (!data?.providers.length) return null;

  return (
    <div
      className="flex flex-col items-center gap-2"
      style={{ opacity: data ? 1 : 0, transition: "opacity 300ms ease-out" }}
    >
      <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">Stream</p>
      <div className="flex items-center gap-2">
        {data.providers.map((provider) => (
          <a
            key={provider.id}
            href={data.justWatchLink ?? undefined}
            target="_blank"
            rel="noreferrer"
            aria-label={`Watch on ${provider.name}`}
            title={provider.name}
            className="overflow-hidden rounded-lg transition-opacity hover:opacity-80"
          >
            <Image
              src={provider.logoUrl}
              alt={provider.name}
              width={36}
              height={36}
              className="h-9 w-9 object-cover"
              unoptimized
            />
          </a>
        ))}
      </div>
    </div>
  );
}
