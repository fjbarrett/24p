import Link from "next/link";
import Image from "next/image";
import { fetchTmdbMovie } from "@/lib/tmdb-server";
import type { PersonLink } from "@/lib/tmdb";
import { AddToListLoader } from "@/components/add-to-list-loader";
import { AppleTvLink } from "@/components/apple-tv-link";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Metadata } from "next";
import { getAppUrl } from "@/lib/app-url";
import { BackButton } from "@/components/back-button";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined> | URLSearchParams>;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const tmdbId = Number(id);
  if (Number.isNaN(tmdbId)) {
    return { title: "Movie" };
  }

  try {
    const movie = await fetchTmdbMovie(tmdbId);
    const title = typeof movie.releaseYear === "number" ? `${movie.title} (${movie.releaseYear})` : movie.title;
    const description = movie.overview?.trim() ? movie.overview : `Details for ${movie.title} on 24p.`;
    const canonical = `/movies/${movie.tmdbId}`;
    const imageUrl = movie.posterUrl ? getLargePoster(movie.posterUrl) : null;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        ...(imageUrl ? { images: [{ url: imageUrl, alt: `${movie.title} poster` }] } : {}),
      },
      twitter: {
        title,
        description,
        ...(imageUrl ? { images: [imageUrl] } : {}),
      },
    };
  } catch {
    return {
      title: "Movie",
      alternates: { canonical: `/movies/${tmdbId}` },
      robots: { index: false, follow: false },
    };
  }
}

export default async function MovieDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, resolvedSearchParams, session] = await Promise.all([
    params,
    searchParams,
    getServerSession(authOptions),
  ]);
  const tmdbId = Number(id);
  if (Number.isNaN(tmdbId)) {
    throw new Error("Invalid TMDB id");
  }

  const typedSession = session as Session | null;
  const userEmail = typedSession?.user?.email?.toLowerCase() ?? "";
  const movie = await fetchTmdbMovie(tmdbId);
  const backHref = getFromParam(resolvedSearchParams) ?? "/";
  const communityRatings = renderCommunityRatings(movie);
  const credits = renderCredits(movie);
  const jsonLd = buildMovieJsonLd(movie);

  return (
    <div className="min-h-screen bg-black-950 px-4 py-6 text-black-100 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="mx-auto max-w-[1100px] space-y-3 rounded-3xl bg-black-900/70 p-3 shadow-2xl backdrop-blur sm:p-4">
        <div className="flex items-center justify-between">
          <BackButton
            fallbackHref={backHref}
            className="inline-flex items-center gap-2 rounded-full bg-black-950/70 px-4 py-2 text-xs font-medium text-black-200 transition hover:-translate-y-0.5 hover:text-white hover:shadow-lg"
            aria-label="Close"
          >
            <span aria-hidden>←</span>
            <span>Back</span>
          </BackButton>
        </div>

        <header className="flex flex-col gap-4 text-left sm:flex-row sm:items-start sm:gap-6">
          <div className="shrink-0">
            {movie.posterUrl ? (
              <Image
                src={getLargePoster(movie.posterUrl)}
                alt={`${movie.title} poster`}
                width={200}
                height={300}
                className="h-auto w-[160px] rounded-3xl object-cover shadow-2xl sm:w-[200px]"
                priority
              />
            ) : (
              <div className="flex aspect-[2/3] w-[160px] items-center justify-center rounded-3xl bg-black-800 text-sm text-black-500 sm:w-[200px]">
                No art yet
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <h1 className="text-4xl font-semibold text-white sm:text-5xl">{movie.title}</h1>
              {typeof movie.releaseYear === "number" || communityRatings ? (
                <div className="flex flex-wrap items-center gap-2 py-1 text-sm text-black-500">
                  {typeof movie.releaseYear === "number" ? <span>{movie.releaseYear}</span> : null}
                  {communityRatings}
                </div>
              ) : null}
            </div>

            {movie.overview && <p className="text-base leading-relaxed text-black-200">{movie.overview}</p>}

            {userEmail ? <AddToListLoader tmdbId={movie.tmdbId} userEmail={userEmail} /> : null}

            {credits ? <div className="space-y-2">{credits}</div> : null}

            {movie.imdbId ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <AppleTvLink imdbId={movie.imdbId} title={movie.title} />
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

function buildMovieJsonLd(movie: {
  tmdbId: number;
  title: string;
  overview?: string | null;
  releaseYear?: number | null;
  posterUrl?: string | null;
  imdbId?: string | null;
}) {
  const canonicalUrl = new URL(`/movies/${movie.tmdbId}`, getAppUrl()).toString();
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.title,
    description: movie.overview ?? undefined,
    image: movie.posterUrl ? getLargePoster(movie.posterUrl) : undefined,
    datePublished: movie.releaseYear ? `${movie.releaseYear}-01-01` : undefined,
    url: canonicalUrl,
  };

  if (movie.imdbId) {
    schema.sameAs = `https://www.imdb.com/title/${movie.imdbId}/`;
  }

  return schema;
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
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        item.href ? (
          <a
            key={item.key}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-black-950/60 px-2 py-1 text-xs font-medium text-black-200 transition hover:-translate-y-0.5 hover:text-white hover:shadow-lg"
          >
            {item.icon ? (
              <Image src={item.icon} alt={`${item.label} logo`} width={18} height={18} className="h-4 w-auto" />
            ) : null}
            <span className="text-black-100">{item.value}</span>
          </a>
        ) : (
          <span key={item.key} className="inline-flex items-center gap-1 text-black-200">
            {item.icon ? (
              <Image src={item.icon} alt={`${item.label} logo`} width={18} height={18} className="h-4 w-auto" />
            ) : null}
            <span className="text-black-100">{item.value}</span>
          </span>
        )
      ))}
    </div>
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
    <div className="rounded-2xl bg-black-950/60">
      <p className="text-xs uppercase tracking-[0.3em] text-black-500">Credits</p>
      <div className="mt-2 space-y-2 text-sm text-black-200">
        {director ? (
          <div className="flex flex-wrap gap-x-2">
            <span className="font-semibold text-black-300">Director</span>
            <PersonLinkRow person={director} />
          </div>
        ) : null}
        {cinematographer ? (
          <div className="flex flex-wrap gap-x-2">
            <span className="font-semibold text-black-300">Director of Photography</span>
            <PersonLinkRow person={cinematographer} />
          </div>
        ) : null}
        {cast.length ? (
          <div className="space-y-1">
            <div className="font-semibold text-black-300">Cast</div>
            <div className="space-y-1">
              {cast.map((person) => (
                <div key={`${person.tmdbId}-${person.name}`}>
                  <PersonLinkRow person={person} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PersonLinkRow({ person }: { person: PersonLink }) {
  const label = person.role ? `${person.name} (${person.role})` : person.name;
  return (
    <Link href={`/artists/${person.tmdbId}`} className="underline-offset-4 hover:underline">
      {label}
    </Link>
  );
}
