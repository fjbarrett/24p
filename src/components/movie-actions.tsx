"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AddToListButton } from "@/components/add-to-list-loader";
import { AppleTvLink } from "@/components/apple-tv-link";

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
};

export function MovieActions({ tmdbId, userEmail, imdbId, title }: MovieActionsProps) {
  const [listExpanded, setListExpanded] = useState(false);
  const [revealed, setRevealed] = useState(!imdbId);
  const [providers, setProviders] = useState<{ items: StreamingProvider[]; link: string | null }>({ items: [], link: null });

  useEffect(() => {
    if (!userEmail) return;
    let active = true;
    fetch(`/api/watch-providers?tmdbId=${tmdbId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (active && data?.providers?.length) {
          setProviders({ items: data.providers, link: data.justWatchLink });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [tmdbId, userEmail]);

  const slotVisible = !listExpanded;
  const hasSlot = imdbId || providers.items.length > 0;

  return (
    <div
      className="mt-6"
      style={{
        opacity: revealed ? 1 : 0,
        transition: 'opacity 500ms ease-out',
      }}
    >
      <AddToListButton
        tmdbId={tmdbId}
        userEmail={userEmail}
        onExpandChange={setListExpanded}
        appleTvSlot={
          hasSlot ? (
            <div
              className="flex items-center gap-2"
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
              {imdbId && (
                <AppleTvLink imdbId={imdbId} title={title} onReveal={() => setRevealed(true)} />
              )}
              {providers.items.map((provider) => (
                <a
                  key={provider.id}
                  href={providers.link ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Watch on ${provider.name}`}
                  title={provider.name}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white"
                >
                  <Image
                    src={provider.logoUrl}
                    alt={provider.name}
                    width={44}
                    height={44}
                    className="h-11 w-11 object-cover"
                    unoptimized
                  />
                </a>
              ))}
            </div>
          ) : null
        }
      />
    </div>
  );
}
