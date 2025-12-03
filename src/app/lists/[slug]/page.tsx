import Image from "next/image";
import Link from "next/link";
import { getListBySlug } from "@/lib/list-store";
import { fetchTmdbMovies } from "@/lib/tmdb-server";
import type { SimplifiedMovie } from "@/lib/tmdb";
import { ListEditor } from "@/components/list-editor";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRatingsForUser } from "@/lib/ratings-store";

export const dynamic = "force-dynamic";

export default async function ListDetail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined> | URLSearchParams>;
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const sort =
    resolvedSearchParams instanceof URLSearchParams
      ? resolvedSearchParams.get("sort")
      : (() => {
          const sortParam = resolvedSearchParams?.sort;
          return Array.isArray(sortParam) ? sortParam[0] : sortParam;
        })();
  const list = await getListBySlug(slug);

  if (!list) {
    return (
      <div className="px-4 py-10 text-black-100">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-black-900/40 p-8 text-center">
          <p className="text-sm text-black-400">List not found.</p>
          <Link href="/" className="mt-4 inline-flex rounded-full border border-black-600 px-5 py-2 text-sm text-black-200">
            Return home
          </Link>
        </div>
      </div>
    );
  }

  const movies = list.movies.length ? await fetchTmdbMovies(list.movies) : [];
  const session = await getServerSession(authOptions);
  const viewerEmail = session?.user?.email?.toLowerCase() ?? null;
  const ratingsMap = viewerEmail ? await getRatingsForUser(viewerEmail) : {};
  const sortedMovies = sort === "rating" ? sortMoviesByRating(movies, ratingsMap, list.movies) : movies;
  const fromParam = encodeURIComponent(`/lists/${list.slug}`);

  return (
    <div className="px-4 py-10 text-black-100 sm:px-8 lg:px-16">
      <div className="mx-auto max-w-[1000px] space-y-6 rounded-3xl border border-white/10 bg-black-900/70 p-6 shadow-2xl backdrop-blur">
              <div className="flex justify-left">
       <Link href="/" className="rounded-full px-4 py-2 text-sm text-black-200">
            {/* <span aria-hidden>⟵</span> */}
            <span>Back</span>
          </Link>
        </div>
        <div className="flex items-center justify-between" style={{paddingLeft: 16}}>
          <h1 className="text-3xl font-semibold text-white">{list.title}</h1>
        </div>
        <ListEditor list={list} viewerEmail={viewerEmail} />

        <section className="space-y-3">
        {sortedMovies.length === 0 ? (
            <p className="text-sm text-black-500">No movies yet. Add some from the detail pages.</p>
          ) : (
            <ul className="flex flex-wrap justify-start gap-3" style={{ paddingLeft: 16 }}>
              {sortedMovies.map((movie) => (
                <li key={movie.tmdbId}>
                  <Link
                    href={`/movies/${movie.tmdbId}?from=${fromParam}`}
                    className="group relative block overflow-hidden rounded-lg border border-white/10 bg-black-900/40 transition hover:border-black-400"
                    style={{ width: 160, height: 240 }}
                  >
                    {movie.posterUrl ? (
                      <Image
                        src={getLargePoster(movie.posterUrl)}
                        alt={`${movie.title} poster`}
                        width={160}
                        height={240}
                        sizes="160px"
                        className="h-full w-full rounded-md object-cover transition duration-300 group-hover:scale-105"
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
          )}
        </section>
      </div>
    </div>
  );
}

function sortMoviesByRating(
  movies: SimplifiedMovie[],
  ratingsMap: Record<number, number>,
  originalOrder: number[],
) {
  if (!movies.length) return movies;

  const position = new Map<number, number>();
  originalOrder.forEach((tmdbId, index) => position.set(tmdbId, index));

  const getScore = (movie: SimplifiedMovie) => {
    const userRating = ratingsMap[movie.tmdbId];
    if (typeof userRating === "number") return userRating;
    if (typeof movie.rating === "number") return movie.rating;
    return -Infinity;
  };

  return [...movies].sort((a, b) => {
    const scoreDelta = getScore(b) - getScore(a);
    if (scoreDelta !== 0) return scoreDelta;
    const indexA = position.get(a.tmdbId) ?? Number.MAX_SAFE_INTEGER;
    const indexB = position.get(b.tmdbId) ?? Number.MAX_SAFE_INTEGER;
    return indexA - indexB;
  });
}

function getLargePoster(url: string): string {
  return url.includes("/w185/") ? url.replace("/w185/", "/w500/") : url;
}
