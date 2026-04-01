"use client";

import { useEffect, useState } from "react";

type AppleTvLinkProps = {
  imdbId: string;
  title: string;
};

type AppleTvPayload = {
  url: string | null;
  price: string | null;
};

export function AppleTvLink({ imdbId, title }: AppleTvLinkProps) {
  const [link, setLink] = useState<AppleTvPayload | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const params = new URLSearchParams({ imdbId, title });
        const response = await fetch(`/api/apple-tv?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) return;
        const payload = (await response.json()) as AppleTvPayload;
        if (active) {
          setLink(payload);
        }
      } catch {
        // ignore background fetch errors
      }
    }

    if (imdbId) {
      load();
    }

    return () => {
      active = false;
      controller.abort();
    };
  }, [imdbId, title]);

  if (!link?.url) return null;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <span>Watch on Apple TV</span>
      {link.price ? <span className="text-black-500">({link.price})</span> : null}
    </a>
  );
}
