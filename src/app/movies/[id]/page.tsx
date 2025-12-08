import Link from "next/link";
import Image from "next/image";
import { fetchTmdbMovie } from "@/lib/tmdb-server";
import { loadLists } from "@/lib/list-store";
import type { SavedList } from "@/lib/list-store";
import { MovieListActions } from "@/components/movie-list-actions";
import { UserRating } from "@/components/user-rating";
import { getRating } from "@/lib/ratings-store";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchAppleTvLink } from "@/lib/apple-links";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined> | URLSearchParams>;
};

export default async function MovieDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const tmdbId = Number(id);
  if (Number.isNaN(tmdbId)) {
    throw new Error("Invalid TMDB id");
  }

  const [movie, session] = await Promise.all([fetchTmdbMovie(tmdbId), getServerSession(authOptions)]);
  const userEmail = session?.user?.email?.toLowerCase() ?? null;
  const appleLink = movie.imdbId ? await fetchAppleTvLink(movie.imdbId, movie.title) : { url: null, price: null };
  const lists = userEmail ? await loadLists(userEmail) : [];
  const listsContaining = lists.filter((list) => list.movies.includes(tmdbId));
  const userRating = userEmail ? await getRating(userEmail, tmdbId) : null;
  const backHref = getFromParam(resolvedSearchParams) ?? "/";

  return (
    <div className="text-black-100">
      <article className="mx-auto max-w-[1000px] space-y-6 rounded-3xl bg-black-900/70 p-6 shadow-2xl backdrop-blur">
        <div className="flex justify-left">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-black-200 transition hover:border-black-300"
            aria-label="Close"
          >
            {/* <span aria-hidden>⟵</span> */}
            <span>Back</span>
          </Link>
        </div>
        <header className="flex flex-col items-start gap-4 text-left sm:flex-row sm:items-start">
          {movie.posterUrl ? (
            <Image
              src={getLargePoster(movie.posterUrl)}
              alt={`${movie.title} poster`}
              width={200}
              height={300}
              className="h-[300px] w-[200px] rounded-2xl object-cover shadow-lg"
            />
          ) : (
            <div className="flex h-[300px] w-[200px] items-center justify-center rounded-2xl bg-black-800 text-sm text-black-500">
              No art yet
            </div>
          )}
          <div className="flex-1 space-y-3">
            <h1 className="text-4xl font-semibold text-white sm:text-5xl">{movie.title}</h1>
            <p className="text-sm text-black-400">
              {movie.releaseYear ?? "—"} · {movie.runtime ? `${movie.runtime}m` : "Runtime TBD"}
            </p>
            {movie.genres?.length ? (
              <p className="text-sm text-black-400">{movie.genres.join(" • ")}</p>
            ) : null}
            {renderCommunityRatings(movie)}
            <WatchOnAppleTv url={appleLink.url} price={appleLink.price} />
            {movie.tagline && <p className="text-base italic text-black-300">“{movie.tagline}”</p>}
            {movie.overview && <p className="text-base text-black-300">{movie.overview}</p>}
            <div className="h-1" />
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <MovieRatingCard
            movie={movie}
            userRating={userRating}
            lists={listsContaining}
            tmdbId={tmdbId}
            userEmail={userEmail ?? null}
          />
          <MovieListActions lists={lists} tmdbId={tmdbId} userEmail={userEmail} />
        </section>
      </article>
    </div>
  );
}

function getFromParam(
  search: Record<string, string | string[] | undefined> | URLSearchParams | undefined,
) {
  const raw =
    search instanceof URLSearchParams
      ? search.get("from")
      : (() => {
          const value = search?.from;
          return Array.isArray(value) ? value[0] : value;
        })();
  if (!raw) return null;
  const decoded = safeDecode(raw);
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
  return decoded;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getLargePoster(url: string): string {
  return url.includes("/w185/") ? url.replace("/w185/", "/w500/") : url;
}

function renderCommunityRatings(movie: {
  rating?: number;
  imdbRating?: number;
  letterboxdRating?: number;
  imdbId?: string;
  tmdbId?: number;
}) {
  const items: { key: string; href: string; value: string }[] = [];
  if (typeof movie.imdbRating === "number" && movie.imdbId) {
    const href = `https://www.imdb.com/title/${movie.imdbId}/`;
    items.push({ key: "imdb", href, value: movie.imdbRating.toFixed(1) });
  }
  if (typeof movie.letterboxdRating === "number" && movie.tmdbId != null) {
    const href = `https://letterboxd.com/tmdb/${movie.tmdbId}/`;
    items.push({ key: "lb", href, value: movie.letterboxdRating.toFixed(2) });
  }
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-black-200">
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
        >
          <span className="text-black-400 uppercase text-[10px] tracking-[0.15em]">{item.key.toUpperCase()}</span>
          <span className="text-black-100">{item.value}</span>
        </a>
      ))}
    </div>
  );
}

function WatchOnAppleTv({ url, price }: { url: string | null; price: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <span>Watch on Apple TV</span>
      {price ? <span className="text-black-500">({price})</span> : null}
    </a>
  );
}

function MovieRatingCard({
  userRating,
  lists,
  tmdbId,
  userEmail,
}: {
  userRating: number | null;
  lists: SavedList[];
  tmdbId: number;
  userEmail: string | null;
}) {
  return (
    <div className="space-y-5 rounded-3xl bg-black-950/60 p-5">
      <UserRating tmdbId={tmdbId} initialRating={userRating} userEmail={userEmail} />
      <div className="mt-4 pt-4">
        <p className="text-xs uppercase tracking-[0.3em] text-black-400">Lists featuring this film</p>
        {lists.length === 0 ? (
          <p className="mt-2 text-xs text-black-500">Not in any list yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {lists.map((list) => (
              <li key={list.id}>
                <Link href={`/lists/${list.slug}`} className="text-black-200 hover:text-white">
                  {list.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
