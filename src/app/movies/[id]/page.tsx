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
      <article className="mx-auto max-w-[1180px] space-y-6 rounded-[28px] border border-white/10 bg-black-900/70 p-4 shadow-2xl backdrop-blur sm:p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <BackButton
            fallbackHref={backHref}
            className="inline-flex items-center gap-2 rounded-full bg-black-950/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-black-300 transition hover:bg-black-950 hover:text-white"
            aria-label="Close"
          >
            <span aria-hidden>←</span>
            <span>Back</span>
          </BackButton>
        </div>

        <header className="grid gap-6 text-left lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
          <div className="mx-auto w-full max-w-[220px] shrink-0 lg:mx-0">
            {movie.posterUrl ? (
              <Image
                src={getLargePoster(movie.posterUrl)}
                alt={`${movie.title} poster`}
                width={200}
                height={300}
                className="h-auto w-full rounded-3xl object-cover shadow-2xl"
                priority
              />
            ) : (
              <div className="flex aspect-[2/3] w-full items-center justify-center rounded-3xl bg-black-800 text-sm text-black-500">
                No art yet
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-5">
            <div className="space-y-3">
              <div className="space-y-2">
                <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">{movie.title}</h1>
                {typeof movie.releaseYear === "number" || communityRatings ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-black-400">
                    {typeof movie.releaseYear === "number" ? (
                      <span className="inline-flex items-center rounded-full bg-black-950/70 px-3 py-1 font-medium text-black-200">
                        {movie.releaseYear}
                      </span>
                    ) : null}
                    {communityRatings}
                  </div>
                ) : null}
              </div>

              {(userEmail || movie.imdbId) ? (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="w-full max-w-xl">
                    {userEmail ? <AddToListLoader tmdbId={movie.tmdbId} userEmail={userEmail} /> : null}
                  </div>
                  {movie.imdbId ? (
                    <div className="flex w-full lg:w-auto lg:justify-end">
                      <AppleTvLink imdbId={movie.imdbId} title={movie.title} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {movie.overview ? (
              <section className="rounded-2xl border border-white/10 bg-black-950/60 p-5">
                <p className="text-xs uppercase tracking-[0.35em] text-black-500">Overview</p>
                <p className="mt-3 max-w-3xl text-base leading-8 text-black-200">{movie.overview}</p>
              </section>
            ) : null}

            {credits ? <div>{credits}</div> : null}
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
  imdbId?: string | null;
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
            className="inline-flex items-center gap-2 rounded-full bg-black-950/70 px-3 py-1.5 text-xs font-medium text-black-200 transition hover:bg-black-950 hover:text-white"
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
    <section className="rounded-2xl border border-white/10 bg-black-950/60 p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-black-500">Credits</p>
      <div className="mt-4 space-y-4 text-sm text-black-200">
        {director ? (
          <div className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
            <span className="font-semibold text-black-400">Director</span>
            <PersonLinkRow person={director} />
          </div>
        ) : null}
        {cinematographer ? (
          <div className="grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
            <span className="font-semibold text-black-400">Director of Photography</span>
            <PersonLinkRow person={cinematographer} />
          </div>
        ) : null}
        {cast.length ? (
          <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
            <div className="font-semibold text-black-400">Cast</div>
            <div className="flex flex-wrap gap-2">
              {cast.map((person) => (
                <div key={`${person.tmdbId}-${person.name}`} className="min-w-0">
                  <PersonLinkRow person={person} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PersonLinkRow({ person }: { person: PersonLink }) {
  const label = person.role ? `${person.name} (${person.role})` : person.name;
  return (
    <Link
      href={`/artists/${person.tmdbId}`}
      className="inline-flex rounded-full bg-black-900 px-3 py-1.5 text-black-100 transition hover:bg-black-800"
    >
      {label}
    </Link>
  );
}
