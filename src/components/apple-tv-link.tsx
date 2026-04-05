"use client";

import { useEffect, useRef, useState } from "react";

type AppleTvLinkProps = {
  imdbId: string;
  title: string;
  onReveal?: () => void;
};

type AppleTvPayload = {
  url: string | null;
  price: string | null;
};

export function AppleTvLink({ imdbId, title, onReveal }: AppleTvLinkProps) {
  const [link, setLink] = useState<AppleTvPayload | null>(null);
  const appleTvUrl = link?.url ?? undefined;
  const isVisible = Boolean(appleTvUrl);
  const revealedRef = useRef(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const params = new URLSearchParams({ imdbId, title });
        const [response] = await Promise.all([
          fetch(`/api/apple-tv?${params.toString()}`, { signal: controller.signal }),
          new Promise<void>((resolve) => setTimeout(resolve, 900)),
        ]);
        if (!response.ok) return;
        const payload = (await response.json()) as AppleTvPayload;
        if (active) {
          setLink(payload);
        }
      } catch {
        // ignore background fetch errors
      } finally {
        if (active && !revealedRef.current) {
          revealedRef.current = true;
          onReveal?.();
        }
      }
    }

    if (imdbId) {
      load();
    }

    return () => {
      active = false;
      controller.abort();
    };
  }, [imdbId, title, onReveal]);

  const [hovered, setHovered] = useState(false);

  return (
    <div aria-hidden={!isVisible} className="h-10 flex-shrink-0">
      {isVisible ? (
        <a
          href={appleTvUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Watch on Apple TV"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="flex h-10 items-center justify-start overflow-hidden rounded-full bg-white active:brightness-90"
          style={{
            width: hovered ? 116 : 40,
            transition: 'width 300ms cubic-bezier(0.34,1.2,0.64,1)',
          }}
        >
          {/* Monitor icon — always visible, centered when collapsed */}
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px] flex-shrink-0 fill-black" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h11A2.5 2.5 0 0 1 18 4.5v8a2.5 2.5 0 0 1-2.5 2.5H12l.5 1.5H14a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1 0-1.5h1.5L8 15H4.5A2.5 2.5 0 0 1 2 12.5v-8ZM4.5 3.5A1 1 0 0 0 3.5 4.5v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-11Z" />
            </svg>
          </span>

          {/* Apple TV label — fades in after pill expands */}
          <span
            className="flex flex-shrink-0 items-center gap-1 pr-3.5"
            style={{
              opacity: hovered ? 1 : 0,
              transition: hovered
                ? 'opacity 150ms ease-out 180ms'
                : 'opacity 80ms ease-in',
            }}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-shrink-0 fill-black" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-black">TV</span>
          </span>
        </a>
      ) : null}
    </div>
  );
}
