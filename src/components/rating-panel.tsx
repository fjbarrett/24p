"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { SimplifiedMovie } from "@/lib/tmdb";

const POSSIBLE_SCORES = Array.from({ length: 10 }, (_, index) => index + 1);

type RatingPanelProps = {
  movie: SimplifiedMovie;
};

export function RatingPanel({ movie }: RatingPanelProps) {
  const [score, setScore] = useState(() => Math.max(1, Math.round(movie.rating ?? 7)));

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (movie.releaseYear) parts.push(`${movie.releaseYear}`);
    if (movie.runtime) parts.push(`${movie.runtime}m`);
    if (movie.genres?.length) parts.push(movie.genres.slice(0, 2).join(" • "));
    return parts.join(" • ");
  }, [movie.genres, movie.releaseYear, movie.runtime]);

  return (
    <div className="rounded-3xl bg-slate-900/60 p-6 shadow-2xl ring-1 ring-white/5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Rate a movie</p>
      <div className="mt-4 flex gap-4">
        {movie.posterUrl ? (
          <Image
            src={movie.posterUrl}
            alt={`${movie.title} poster`}
            width={96}
            height={144}
            className="h-36 w-24 rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-36 w-24 items-center justify-center rounded-2xl bg-slate-800 text-xs text-slate-500">
            Poster soon
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-2xl font-semibold text-slate-50">{movie.title}</h3>
          {summary && <p className="text-sm text-slate-400">{summary}</p>}
          {movie.tagline && <p className="mt-2 text-sm italic text-slate-300">“{movie.tagline}”</p>}
          {movie.overview && <p className="mt-2 text-sm text-slate-400">{movie.overview}</p>}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Pick a score (out of 10)</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {POSSIBLE_SCORES.map((value) => (
            <button
              key={value}
              onClick={() => setScore(value)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                value === score
                  ? "border-slate-300 bg-slate-200/10 text-slate-100"
                  : "border-slate-600 text-slate-300 hover:border-slate-400/50"
              }`}
            >
              {value}/10
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
        <span>
          Your rating: <strong className="text-slate-50">{score}/10</strong>
        </span>
        <button className="text-slate-200 hover:text-white">Save rating</button>
      </div>
    </div>
  );
}
