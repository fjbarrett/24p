import Link from "next/link";
import Image from "next/image";
import { fetchTmdbMovie } from "@/lib/tmdb-server";
import { fetchAppleTvLink } from "@/lib/apple-links";
import type { PersonLink } from "@/lib/tmdb";

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

  const movie = await fetchTmdbMovie(tmdbId);
  const appleLink = movie.imdbId ? await fetchAppleTvLink(movie.imdbId, movie.title) : { url: null, price: null };
  const backHref = getFromParam(resolvedSearchParams) ?? "/";
  const communityRatings = renderCommunityRatings(movie);
  const credits = renderCredits(movie);

  return (
    <div className="min-h-screen bg-black-950 px-4 py-6 text-black-100 sm:px-6">
      <article className="mx-auto max-w-[1100px] space-y-3 rounded-3xl bg-black-900/70 p-3 shadow-2xl backdrop-blur sm:p-4">
        <div className="flex items-center justify-between">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full bg-black-950/70 px-4 py-2 text-xs font-medium text-black-200 transition hover:-translate-y-0.5 hover:text-white hover:shadow-lg"
            aria-label="Close"
          >
            <span aria-hidden>←</span>
            <span>Back</span>
          </Link>
        </div>

        <header className="flex flex-col gap-4 text-left sm:gap-5">
          <div className="flex flex-col items-start gap-2 sm:gap-3">
            {movie.posterUrl ? (
              <Image
                src={getLargePoster(movie.posterUrl)}
                alt={`${movie.title} poster`}
                width={200}
                height={300}
                className="h-auto w-[200px] max-w-full rounded-3xl object-cover shadow-2xl"
                priority
              />
            ) : (
              <div className="flex aspect-[2/3] w-full items-center justify-center rounded-3xl bg-black-800 text-sm text-black-500">
                No art yet
              </div>
            )}
            {communityRatings ? <div className="mt-[10px] sm:mt-[10px]">{communityRatings}</div> : null}
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <h1 className="text-4xl font-semibold text-white sm:text-5xl">{movie.title}</h1>
              {typeof movie.releaseYear === "number" ? (
                <p className="text-sm text-black-500">{movie.releaseYear}</p>
              ) : null}
            </div>

            {movie.overview && <p className="text-base leading-relaxed text-black-200">{movie.overview}</p>}

            {credits ? <div className="space-y-2">{credits}</div> : null}

            {appleLink.url ? (
              <div className="flex flex-wrap items-center gap-3">
                <WatchOnAppleTv url={appleLink.url} price={appleLink.price} />
              </div>
            ) : null}
          </div>
        </header>
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
  imdbId?: string | null;
  tmdbId?: number;
}) {
  const items: { key: string; href?: string; value: string; label: string; icon?: string }[] = [];
  if (typeof movie.imdbRating === "number" && movie.imdbId) {
    const href = `https://www.imdb.com/title/${movie.imdbId}/`;
    items.push({
      key: "imdb",
      href,
      value: movie.imdbRating.toFixed(1),
      label: "IMDb",
      icon: "/imdb_logo.svg",
    });
  }
  if (typeof movie.letterboxdRating === "number" && movie.tmdbId != null) {
    const href = `https://letterboxd.com/tmdb/${movie.tmdbId}/`;
    items.push({
      key: "lb",
      href,
      value: movie.letterboxdRating.toFixed(2),
      label: "Letterboxd",
      icon: "/letterboxd_logo.svg",
    });
  }
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-black-200">
      {items.map((item) => (
        item.href ? (
          <a
            key={item.key}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline-offset-4"
          >
            {item.icon ? (
              <Image src={item.icon} alt={`${item.label} logo`} width={18} height={18} className="h-4 w-auto" />
            ) : null}
            <span className="text-black-200">{item.value}</span>
          </a>
        ) : (
          <span key={item.key} className="inline-flex items-center gap-1 text-black-200">
            {item.icon ? (
              <Image src={item.icon} alt={`${item.label} logo`} width={18} height={18} className="h-4 w-auto" />
            ) : null}
            <span>{item.value}</span>
          </span>
        )
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

function renderCredits(movie: {
  director?: PersonLink | null;
  cinematographer?: PersonLink | null;
  cast?: PersonLink[];
}) {
  const director = movie.director ?? null;
  const cinematographer = movie.cinematographer ?? null;
  const cast = movie.cast?.slice(0, 6) ?? [];
  if (!director && !cinematographer && !cast.length) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-black-950/60 p-3">
      <p className="text-xs uppercase tracking-[0.3em] text-black-500">Credits</p>
      <div className="mt-2 space-y-2 text-sm text-black-200">
        {director ? (
          <div className="flex flex-wrap gap-x-2">
            <span className="text-black-500">Director</span>
            <PersonLinkRow person={director} />
          </div>
        ) : null}
        {cinematographer ? (
          <div className="flex flex-wrap gap-x-2">
            <span className="text-black-500">Director of Photography</span>
            <PersonLinkRow person={cinematographer} />
          </div>
        ) : null}
        {cast.length ? (
          <div className="flex flex-wrap gap-x-2">
            <span className="text-black-500">Cast</span>
            <span className="flex flex-wrap gap-x-2">
              {cast.map((person, index) => (
                <span key={`${person.tmdbId}-${person.name}`} className="inline-flex items-center gap-2">
                  <PersonLinkRow person={person} />
                  {index < cast.length - 1 ? <span className="text-black-600">•</span> : null}
                </span>
              ))}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PersonLinkRow({ person }: { person: PersonLink }) {
  const imdbUrl = person.imdbId ? `https://www.imdb.com/name/${person.imdbId}/` : null;
  const label = person.role ? `${person.name} (${person.role})` : person.name;
  if (!imdbUrl) {
    return <span>{label}</span>;
  }
  return (
    <a href={imdbUrl} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
      {label}
    </a>
  );
}
