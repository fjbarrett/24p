import Image from "next/image";
import { fetchTmdbMovie } from "@/lib/tmdb-server";
import { MovieActions } from "@/components/movie-actions";
import { BackButton } from "@/components/back-button";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Metadata } from "next";
import { getAppUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined> | URLSearchParams>;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const tmdbId = Number(id);
  if (Number.isNaN(tmdbId)) return { title: "Movie" };

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
  if (Number.isNaN(tmdbId)) throw new Error("Invalid TMDB id");

  const typedSession = session as Session | null;
  const userEmail = typedSession?.user?.email?.toLowerCase() ?? "";
  const movie = await fetchTmdbMovie(tmdbId);
  const backHref = getFromParam(resolvedSearchParams) ?? "/";
  const jsonLd = buildMovieJsonLd(movie);

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto w-full max-w-[900px] px-6 pt-6 sm:px-8">
        <BackButton
          fallbackHref={backHref}
          className="text-sm text-white/70 transition hover:text-white"
        >
          ← Back
        </BackButton>
      </div>

      {/* Main content */}
      <div className="flex flex-1 items-center justify-center">
      <div className="flex w-full max-w-sm flex-col items-center px-[51px] py-8">
        {/* Poster */}
        {movie.posterUrl ? (
          <Image
            src={getLargePoster(movie.posterUrl)}
            alt={`${movie.title} poster`}
            width={230}
            height={340}
            className="rounded-xl object-cover shadow-lg"
            priority
          />
        ) : (
          <div className="flex h-[340px] w-[230px] items-center justify-center rounded-xl bg-neutral-800 text-sm text-neutral-500">
            No art
          </div>
        )}

        {/* Title */}
        <h1 className="mt-5 text-center text-2xl text-white">{movie.title}</h1>

        {/* Year · Rating */}
        {(typeof movie.releaseYear === "number" || typeof movie.imdbRating === "number") ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-[#B3B3B3]">
            {typeof movie.releaseYear === "number" ? <span>{movie.releaseYear}</span> : null}
            {typeof movie.imdbRating === "number" && movie.imdbId ? (
              <a
                href={`https://www.imdb.com/title/${movie.imdbId}/`}
                target="_blank"
                rel="noreferrer"
                className="ml-2 flex items-center gap-1 transition hover:opacity-70"
              >
                <Image src="/imdb_logo.svg" alt="IMDb" width={32} height={16} className="h-4 w-auto opacity-90" unoptimized />
                <span>{movie.imdbRating}</span>
              </a>
            ) : null}
          </p>
        ) : null}

        {/* Description */}
        {movie.overview ? (
          <p className="mt-7 w-full text-left text-sm leading-relaxed text-[#FAFAFA]" style={{ fontFamily: '"Open Sans", Arial, sans-serif' }}>
            {movie.overview}
          </p>
        ) : null}

        {/* Action buttons */}
        {(userEmail || movie.imdbId) ? (
          <MovieActions tmdbId={movie.tmdbId} userEmail={userEmail} imdbId={movie.imdbId} title={movie.title} />
        ) : null}
      </div>
      </div>
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
