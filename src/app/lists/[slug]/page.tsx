import Link from "next/link";
import Image from "next/image";
import { getListBySlug } from "@/lib/list-store";
import { fetchTmdbMovies } from "@/lib/tmdb-server";
import { ListEditor } from "@/components/list-editor";

export default async function ListDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const list = await getListBySlug(slug);

  if (!list) {
    return (
      <div className="px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-slate-900/40 p-8 text-center">
          <p className="text-sm text-slate-400">List not found.</p>
          <Link href="/" className="mt-4 inline-flex rounded-full border border-slate-600 px-5 py-2 text-sm text-slate-200">
            Return home
          </Link>
        </div>
      </div>
    );
  }

  const movies = list.movies.length ? await fetchTmdbMovies(list.movies) : [];

  return (
    <div className="px-4 py-10 text-slate-100 sm:px-8 lg:px-16">
      <div className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-white/10 bg-slate-900/40 p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">List detail</p>
            <h1 className="text-3xl font-semibold text-white">{list.title}</h1>
          </div>
          <Link href="/" className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200">
            Close
          </Link>
        </div>
        <ListEditor list={list} />

        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Titles in this list</p>
          {movies.length === 0 ? (
            <p className="text-sm text-slate-500">No movies yet. Add some from the detail pages.</p>
          ) : (
            <ul className="space-y-3">
              {movies.map((movie) => (
                <li key={movie.tmdbId} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-3">
                  {movie.posterUrl ? (
                    <Image
                      src={movie.posterUrl}
                      alt={`${movie.title} poster`}
                      width={48}
                      height={72}
                      className="h-16 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-12 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-500">
                      No art
                    </div>
                  )}
                  <div className="flex-1">
                    <Link href={`/movies/${movie.tmdbId}`} className="text-white hover:text-sky-300">
                      {movie.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {movie.releaseYear ?? "—"} • {movie.genres?.slice(0, 2).join(" / ") ?? "Genre TBD"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
