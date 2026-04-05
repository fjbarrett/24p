"use client";

import { useEffect, useState } from "react";
import { AddToListButton } from "@/components/add-to-list-loader";
import { WatchButton } from "@/components/watch-button";

type MovieActionsProps = {
  tmdbId: number;
  userEmail: string;
  imdbId?: string | null;
  title: string;
};

export function MovieActions({ tmdbId, userEmail, imdbId, title }: MovieActionsProps) {
  const [listExpanded, setListExpanded] = useState(false);
  const [revealed, setRevealed] = useState(!imdbId);
  const [appleTvUrl, setAppleTvUrl] = useState<string | null>(null);
  const [providers, setProviders] = useState<{ items: { id: number; name: string; logoUrl: string }[]; link: string | null }>({ items: [], link: null });

  useEffect(() => {
    if (!userEmail) return;
    let active = true;

    const watchFetch = fetch(`/api/watch-providers?tmdbId=${tmdbId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (active && data?.providers?.length) setProviders({ items: data.providers, link: data.justWatchLink }); })
      .catch(() => {});

    if (imdbId) {
      const params = new URLSearchParams({ imdbId, title });
      Promise.all([
        fetch(`/api/apple-tv?${params}`).then((r) => r.ok ? r.json() : null),
        new Promise<void>((res) => setTimeout(res, 900)),
        watchFetch,
      ]).then(([data]) => {
        if (!active) return;
        if (data?.url) setAppleTvUrl(data.url);
        setRevealed(true);
      }).catch(() => { if (active) setRevealed(true); });
    } else {
      watchFetch;
    }

    return () => { active = false; };
  }, [tmdbId, userEmail, imdbId, title]);

  const slotVisible = !listExpanded;

  return (
    <div
      className="mt-6"
      style={{ opacity: revealed ? 1 : 0, transition: 'opacity 500ms ease-out' }}
    >
      <AddToListButton
        tmdbId={tmdbId}
        userEmail={userEmail}
        onExpandChange={setListExpanded}
        appleTvSlot={
          <div
            style={{
              opacity: slotVisible ? 1 : 0,
              transform: slotVisible ? 'scale(1)' : 'scale(0.9)',
              pointerEvents: slotVisible ? 'auto' : 'none',
              overflow: 'hidden',
              maxWidth: slotVisible ? '400px' : '0px',
              marginLeft: slotVisible ? '8px' : '0px',
              transition: !slotVisible
                ? 'opacity 150ms ease-in, transform 150ms ease-in, max-width 300ms cubic-bezier(0.4,0,0.2,1), margin-left 300ms cubic-bezier(0.4,0,0.2,1)'
                : 'opacity 200ms ease-out 220ms, transform 200ms ease-out 220ms, max-width 300ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <WatchButton
              appleTvUrl={appleTvUrl}
              providers={providers.items}
              justWatchLink={providers.link}
            />
          </div>
        }
      />
    </div>
  );
}
