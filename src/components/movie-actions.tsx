"use client";

import { useEffect, useState } from "react";
import { AddToListButton } from "@/components/add-to-list-loader";
import { WatchButton } from "@/components/watch-button";

type StreamingProvider = {
  id: number;
  name: string;
  logoUrl: string;
};

type MovieActionsProps = {
  tmdbId: number;
  userEmail: string;
  imdbId?: string | null;
  title: string;
  releaseYear?: number;
};

export function MovieActions({ tmdbId, userEmail, imdbId, title, releaseYear }: MovieActionsProps) {
  const [listExpanded, setListExpanded] = useState(false);
  const [watchExpanded, setWatchExpanded] = useState(false);
  const [revealed, setRevealed] = useState(!imdbId);
  const [appleTvUrl, setAppleTvUrl] = useState<string | null>(null);
  const [providers, setProviders] = useState<{ items: StreamingProvider[]; link: string | null }>({ items: [], link: null });
  const [directUrls, setDirectUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!userEmail) return;
    let active = true;

    // Fetch streaming providers + direct JustWatch links in parallel
    const providersFetch = fetch(`/api/watch-providers?tmdbId=${tmdbId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (active && data?.providers?.length) {
          setProviders({ items: data.providers, link: data.justWatchLink });
        }
      })
      .catch(() => {});

    const yearParam = releaseYear ? `&year=${releaseYear}` : "";
    const linksFetch = fetch(`/api/watch-links?title=${encodeURIComponent(title)}${yearParam}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (active && data) setDirectUrls(data as Record<number, string>); })
      .catch(() => {});

    if (imdbId) {
      const params = new URLSearchParams({ imdbId, title });
      Promise.all([
        fetch(`/api/apple-tv?${params}`).then((r) => r.ok ? r.json() : null),
        new Promise<void>((res) => setTimeout(res, 900)),
        providersFetch,
        linksFetch,
      ]).then(([data]) => {
        if (!active) return;
        if (data?.url) setAppleTvUrl(data.url);
        setRevealed(true);
      }).catch(() => { if (active) setRevealed(true); });
    } else {
      void Promise.all([providersFetch, linksFetch]);
    }

    return () => { active = false; };
  }, [tmdbId, userEmail, imdbId, title, releaseYear]);

  const slotVisible = !listExpanded;

  return (
    <div
      className="mt-3"
      style={{ opacity: revealed ? 1 : 0, transition: 'opacity 500ms ease-out' }}
    >
      <div className="flex w-full max-w-[420px] items-start">
        <AddToListButton
          tmdbId={tmdbId}
          userEmail={userEmail}
          onExpandChange={setListExpanded}
          hidden={watchExpanded}
        />

        <div
          className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            opacity: slotVisible ? 1 : 0,
            transform: slotVisible ? 'scale(1)' : 'scale(0.9)',
            pointerEvents: slotVisible ? 'auto' : 'none',
            width: slotVisible ? (watchExpanded ? '100%' : '44px') : '0px',
            maxWidth: slotVisible ? '420px' : '0px',
            marginLeft: slotVisible && !watchExpanded ? '8px' : '0px',
          }}
        >
          <WatchButton
            appleTvUrl={appleTvUrl}
            providers={providers.items}
            justWatchLink={providers.link}
            directUrls={directUrls}
            onExpandChange={setWatchExpanded}
            expandedWidth="100%"
          />
        </div>
      </div>
    </div>
  );
}
