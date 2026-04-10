"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Clapperboard } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

type MovieTrailerToggleProps = {
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  trailerEndpoint?: string;
};

export function MovieTrailerToggle({ tmdbId, title, posterUrl, backdropUrl, trailerEndpoint }: MovieTrailerToggleProps) {
  const endpoint = trailerEndpoint ?? `/tmdb/movie/${tmdbId}/trailer`;
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [hasTrailer, setHasTrailer] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Pre-check if trailer exists
    apiFetch<{ embedUrl: string | null }>(endpoint)
      .then(res => {
        setHasTrailer(!!res.embedUrl);
        if (res.embedUrl) setTrailerUrl(res.embedUrl);
      })
      .catch(() => setHasTrailer(false));
  }, [endpoint]);

  async function handleToggle() {
    if (active || visible) {
      setVisible(false);
      window.setTimeout(() => {
        setActive(false);
        setTransitioning(false);
      }, 700);
      return;
    }

    if (trailerUrl) {
      setTransitioning(true);
      setActive(true);
      window.setTimeout(() => {
        setVisible(true);
      }, 350);
      return;
    }

    setLoading(true);
    try {
      const trailer = await apiFetch<{ embedUrl: string | null }>(endpoint);
      if (!trailer.embedUrl) {
        setHasTrailer(false);
        return;
      }
      setTrailerUrl(trailer.embedUrl);
      setHasTrailer(true);
      setTransitioning(true);
      setActive(true);
      window.setTimeout(() => {
        setVisible(true);
      }, 350);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center">
      <div className={`relative w-full overflow-hidden rounded-2xl bg-neutral-900 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${active ? "aspect-video max-w-[800px]" : "aspect-[2/3] max-w-[220px]"}`}>
        
        {/* Instant black fill — appears on click so poster fades into darkness */}
        {(active || transitioning) && (
          <div className="absolute inset-0 bg-black" />
        )}

        {/* Poster (Standard View) */}
        {posterUrl && (
          <div className={`absolute inset-0 transition-opacity duration-300 ${active ? "pointer-events-none opacity-0" : "opacity-100"}`}>
            <Image
              src={posterUrl}
              alt={`${title} poster`}
              fill
              className="object-cover"
              priority
            />
            
            {/* Clickable area for poster to also toggle trailer */}
            {hasTrailer !== false && (
              <button
                type="button"
                onClick={() => void handleToggle()}
                disabled={loading}
                aria-label={`Play trailer for ${title}`}
                className="group absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 hover:bg-black/40"
              >
                <div className="rounded-full bg-white/10 p-4 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:opacity-100">
                  <Clapperboard className="h-8 w-8 text-white" />
                </div>
              </button>
            )}
          </div>
        )}

        {!posterUrl && !loading && (
          <div className="flex h-full w-full items-center justify-center text-sm text-neutral-500">No art available</div>
        )}

        {/* Trailer Iframe */}
        {active && trailerUrl && (
          <div className={`absolute inset-0 bg-black transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-0"}`}>
            <iframe
              src={trailerUrl}
              title={`${title} trailer`}
              className="h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        )}
      </div>
    </div>
  );
}
