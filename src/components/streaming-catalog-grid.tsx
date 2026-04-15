"use client";

import Image from "next/image";
import Link from "next/link";
import type { StreamingCatalogMovie } from "@/lib/server/justwatch";

type StreamingCatalogGridProps = {
  movies: StreamingCatalogMovie[];
  providerIcons: Record<string, string>;
};

export function StreamingCatalogGrid({ movies, providerIcons }: StreamingCatalogGridProps) {
  if (!movies.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-center">
        <p className="text-sm text-white/60">No streaming titles matched that platform right now.</p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4 sm:gap-5">
      {movies.map((movie) => (
        <li key={movie.tmdbId}>
          <StreamingCatalogCard movie={movie} providerIcon={providerIcons[movie.providerShortName] ?? null} />
        </li>
      ))}
    </ul>
  );
}

function StreamingCatalogCard({
  movie,
  providerIcon,
}: {
  movie: StreamingCatalogMovie;
  providerIcon: string | null;
}) {
  const href = movie.contentType === "SHOW" ? `/tv/${movie.tmdbId}` : `/movies/${movie.tmdbId}`;
  const imageUrl = movie.posterUrl ?? movie.backdropUrls[0] ?? null;
  const imageAlt = movie.posterUrl ? `${movie.title} poster` : `${movie.title} artwork`;

  return (
    <div className="group relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-neutral-900">
      {/* Card link covers the full card beneath the provider badge */}
      <Link
        href={href}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        aria-label={movie.title}
      />
      <div className="pointer-events-none absolute inset-0 z-10 rounded-lg shadow-[inset_0_0_20px_rgba(0,0,0,0.55)] transition-shadow duration-300 group-hover:shadow-[inset_0_0_20px_rgba(255,255,255,0.06)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          sizes="(max-width: 1024px) 50vw, 33vw"
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-white/40">No art</div>
      )}

      {providerIcon ? (
        <a
          href={movie.primaryOfferUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          aria-label={`Watch ${movie.title} on ${movie.providerName}`}
          className="absolute bottom-1.5 left-1.5 z-20 rounded-lg bg-black/70 p-1 backdrop-blur-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Image
            src={providerIcon}
            alt={movie.providerName}
            width={20}
            height={20}
            className="h-5 w-5 rounded-[4px] object-cover"
            unoptimized
          />
        </a>
      ) : null}

      {typeof movie.imdbRating === "number" && movie.imdbId ? (
        <a
          href={`https://www.imdb.com/title/${movie.imdbId}/`}
          target="_blank"
          rel="noreferrer"
          aria-label={`${movie.title} on IMDb — ${movie.imdbRating.toFixed(1)}`}
          className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1 rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <Image src="/imdb_logo.svg" alt="IMDb" width={28} height={14} className="h-3.5 w-auto" unoptimized />
          <span className="text-[11px] font-medium text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{movie.imdbRating.toFixed(1)}</span>
        </a>
      ) : null}
    </div>
  );
}
