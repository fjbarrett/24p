import Link from "next/link";
import Image from "next/image";
import { fetchTmdbMovie } from "@/lib/tmdb-server";
import { loadLists } from "@/lib/list-store";
import type { SimplifiedMovie } from "@/lib/tmdb";
import { MovieListActions } from "@/components/movie-list-actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MovieDetailPage({ params }: PageProps) {
  const { id } = await params;
  const tmdbId = Number(id);
  if (Number.isNaN(tmdbId)) {
    throw new Error("Invalid TMDB id");
  }

  const movie = await fetchTmdbMovie(tmdbId);
  const lists = await loadLists();

  return (
    <div className="px-4 py-10 text-slate-100 sm:px-8 lg:px-16">
      <div className="mx-auto mb-4 max-w-4xl flex justify-end">
        <Link
          href="/"
          className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-300"
        >
          Close
        </Link>
      </div>
      <article className="mx-auto max-w-4xl space-y-8 rounded-3xl border border-white/10 bg-slate-900/40 p-8 shadow-xl">
        <header className="flex flex-col gap-6 lg:flex-row">
          {movie.posterUrl ? (
            <Image
              src={movie.posterUrl}
              alt={`${movie.title} poster`}
              width={200}
              height={300}
              className="h-72 w-48 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-72 w-48 items-center justify-center rounded-2xl bg-slate-800 text-sm text-slate-500">
              No art yet
            </div>
          )}
          <div className="flex-1 space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Film detail</p>
            <h1 className="text-4xl font-semibold text-white">{movie.title}</h1>
            <p className="text-sm text-slate-400">
              {movie.releaseYear ?? "—"} · {movie.runtime ? `${movie.runtime}m` : "Runtime TBD"}
            </p>
            {movie.genres?.length ? (
              <p className="text-sm text-slate-400">{movie.genres.join(" • ")}</p>
            ) : null}
            {movie.tagline && <p className="text-base italic text-slate-300">“{movie.tagline}”</p>}
            {movie.overview && <p className="text-base text-slate-300">{movie.overview}</p>}
            <div className="flex gap-3">
              <Link
                href={`mailto:?subject=Let's watch ${movie.title}&body=Check out this list: https://24p.app/movies/${tmdbId}`}
                className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-300"
              >
                Share
              </Link>
              <Link
                href="/"
                className="rounded-full border border-sky-300 px-4 py-2 text-sm text-sky-200 transition hover:bg-sky-300/10"
              >
                Back to lists
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <MovieRatingCard movie={movie} />
          <MovieListActions lists={lists} tmdbId={tmdbId} movieTitle={movie.title} />
        </section>
      </article>
    </div>
  );
}

function MovieRatingCard({ movie }: { movie: SimplifiedMovie }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Rate it</p>
      <p className="mt-2 text-sm text-slate-500">
        Community score: {typeof movie.rating === "number" ? `${movie.rating.toFixed(1)}/10` : "TBD"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
          <button key={value} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200">
            {value}/10
          </button>
        ))}
      </div>
    </div>
  );
}
