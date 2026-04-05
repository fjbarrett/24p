"use client";

import { useState } from "react";
import Image from "next/image";

type Provider = {
  id: number;
  name: string;
  logoUrl: string;
};

type WatchButtonProps = {
  appleTvUrl?: string | null;
  providers: Provider[];
  justWatchLink: string | null;
};

export function WatchButton({ appleTvUrl, providers, justWatchLink }: WatchButtonProps) {
  const [expanded, setExpanded] = useState(false);

  const totalItems = providers.length + (appleTvUrl ? 1 : 0);
  if (totalItems === 0) return <div className="h-11 w-11" />;

  // 8px left pad + 28px close + 8px gap + each item 32px + 8px gap + 8px right pad
  const expandedWidth = 8 + 28 + 8 + totalItems * 40 + 8;

  return (
    <div
      className="relative h-11 flex-shrink-0 overflow-hidden rounded-full bg-white transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{ width: expanded ? expandedWidth : 44 }}
    >
      {/* TV icon — collapsed trigger */}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="See where to watch"
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-150"
        style={{ opacity: expanded ? 0 : 1, transitionDelay: expanded ? '0ms' : '200ms', pointerEvents: expanded ? 'none' : 'auto' }}
      >
        <svg viewBox="0 0 20 20" className="h-[18px] w-[18px] fill-black" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h11A2.5 2.5 0 0 1 18 4.5v8a2.5 2.5 0 0 1-2.5 2.5H12l.5 1.5H14a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1 0-1.5h1.5L8 15H4.5A2.5 2.5 0 0 1 2 12.5v-8ZM4.5 3.5A1 1 0 0 0 3.5 4.5v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-11Z" />
        </svg>
      </button>

      {/* Expanded content */}
      <div
        className="absolute inset-0 flex items-center gap-2 pl-2 pr-2 transition-opacity duration-150"
        style={{ opacity: expanded ? 1 : 0, transitionDelay: expanded ? '180ms' : '0ms', pointerEvents: expanded ? 'auto' : 'none' }}
      >
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="shrink-0 text-sm text-black/40 transition hover:text-black"
          aria-label="Close"
        >
          ✕
        </button>

        {providers.map((provider) => (
          <a
            key={provider.id}
            href={justWatchLink ?? undefined}
            target="_blank"
            rel="noreferrer"
            aria-label={`Watch on ${provider.name}`}
            title={provider.name}
            className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg transition-opacity hover:opacity-75"
          >
            <Image src={provider.logoUrl} alt={provider.name} width={32} height={32} className="h-8 w-8 object-cover" unoptimized />
          </a>
        ))}

        {appleTvUrl && (
          <a
            href={appleTvUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Watch on Apple TV"
            title="Apple TV"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-black transition-opacity hover:opacity-75"
          >
            <svg viewBox="0 0 24 24" className="h-[14px] w-[14px] fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
