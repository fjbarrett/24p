"use client";

import Image from "next/image";
import Link from "next/link";
import type { SimplifiedMovie } from "@/lib/tmdb";
import { toMovieSlug } from "@/lib/slug";

type RecommendationsGridProps = {
  movies: SimplifiedMovie[];
};

export function RecommendationsGrid({ movies }: RecommendationsGridProps) {
  if (!movies.length) {
    return (
      <p className="text-sm text-black-500">
        Add films to your lists and we&apos;ll find recommendations for you.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
      {movies.map((movie) => (
        <li key={movie.tmdbId} className="w-[calc(50%-6px)] sm:w-[calc(33%-7px)] lg:w-[calc(25%-9px)]">
          <Link
            href={`/movies/${toMovieSlug(movie.title, movie.releaseYear)}?from=/recommendations`}
            className="group relative block aspect-[2/3] w-full overflow-hidden rounded-lg border border-white/10 bg-black-900/40 transition hover:border-black-400"
          >
            {movie.posterUrl ? (
              <Image
                src={toSmallPoster(movie.posterUrl)}
                alt={`${movie.title} poster`}
                width={200}
                height={300}
                sizes="(max-width: 640px) 26vw, (max-width: 768px) 22vw, 160px"
                className="h-full w-full rounded-md object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-black-800 text-[10px] text-black-500">
                No art
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function toSmallPoster(url: string): string {
  return url.includes("/w500/")
    ? url.replace("/w500/", "/w185/")
    : url.includes("/w342/")
      ? url.replace("/w342/", "/w185/")
      : url;
}
