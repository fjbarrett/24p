import Image from "next/image";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { fetchTmdbMovie } from "@/lib/tmdb-server";
import { resolveMovieSlug } from "@/lib/server/tmdb";
import { MovieActions } from "@/components/movie-actions";
import { DescriptionExpander } from "@/components/description-expander";
import { MovieTrailerToggle } from "@/components/movie-trailer-toggle";
import { StreamingProviderRow } from "@/components/streaming-provider-row";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Metadata } from "next";
import { getAppUrl } from "@/lib/app-url";
import { serializeJsonLd } from "@/lib/json-ld";
import { toMovieSlug, parseLegacyNumericSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function resolveToMovie(slug: string) {
  const legacyId = parseLegacyNumericSlug(slug);
  if (legacyId !== null) {
    const movie = await fetchTmdbMovie(legacyId);
    permanentRedirect(`/movies/${toMovieSlug(movie.title, movie.releaseYear)}`);
  }
  const tmdbId = await resolveMovieSlug(slug);
  if (!tmdbId) return null;
  return fetchTmdbMovie(tmdbId);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const movie = await resolveToMovie(slug);
    if (!movie) return { title: "Movie", robots: { index: false, follow: false } };

    const canonical = `/movies/${toMovieSlug(movie.title, movie.releaseYear)}`;
    const title = typeof movie.releaseYear === "number" ? `${movie.title} (${movie.releaseYear})` : movie.title;
    const description = movie.overview?.trim() ? movie.overview : `Details for ${movie.title} on 24p.`;
    const imageUrl = movie.backdropUrl
      ? getLargeImage(movie.backdropUrl, "backdrop")
      : movie.posterUrl
        ? getLargeImage(movie.posterUrl, "poster")
        : null;

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
    return { title: "Movie", robots: { index: false, follow: false } };
  }
}

export default async function MovieDetailPage({ params }: PageProps) {
  const [{ slug }, session] = await Promise.all([params, getServerSession(authOptions)]);

  const movie = await resolveToMovie(slug);
  if (!movie) notFound();

  // Redirect to canonical slug if it doesn't match
  const canonical = toMovieSlug(movie.title, movie.releaseYear);
  if (slug !== canonical) redirect(`/movies/${canonical}`);

  const typedSession = session as Session | null;
  const userEmail = typedSession?.user?.email?.toLowerCase() ?? "";
  const jsonLd = buildMovieJsonLd(movie);

  return (
    <div className="flex min-h-screen flex-col items-center bg-black text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <div className="mx-auto w-full max-w-[800px] px-6 py-8 sm:px-10">
        <MovieTrailerToggle
          tmdbId={movie.tmdbId}
          title={movie.title}
          posterUrl={movie.posterUrl ? getLargeImage(movie.posterUrl, "poster") : null}
          backdropUrl={movie.backdropUrl ? getLargeImage(movie.backdropUrl, "backdrop") : null}
        />

        <h1
          className="mt-6 mb-3 text-center text-2xl font-semibold tracking-tight !text-white"
          style={{ color: "#fff", WebkitTextFillColor: "#fff", opacity: 1 }}
        >
          {movie.title}
          {typeof movie.releaseYear === "number" ? (
            <span className="ml-2 font-normal text-[#888]">({movie.releaseYear})</span>
          ) : null}
        </h1>

        {typeof movie.imdbRating === "number" ? (
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-[#B3B3B3]">
            {movie.imdbId ? (
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
          </div>
        ) : null}

        <div className="mt-3 flex justify-center">
          <StreamingProviderRow
            tmdbId={movie.tmdbId}
            title={movie.title}
            imdbId={movie.imdbId}
            releaseYear={movie.releaseYear}
          />
        </div>

        {movie.overview ? (
          <div className="mt-4 w-full">
            <DescriptionExpander text={movie.overview} />
          </div>
        ) : null}

        {(userEmail || movie.imdbId) ? (
          <MovieActions tmdbId={movie.tmdbId} userEmail={userEmail} imdbId={movie.imdbId} title={movie.title} releaseYear={movie.releaseYear} />
        ) : null}
      </div>
    </div>
  );
}

function getLargeImage(url: string, type: "poster" | "backdrop"): string {
  if (!url.includes("/w185/")) return url;
  return url.replace("/w185/", type === "backdrop" ? "/w1280/" : "/w780/");
}

function buildMovieJsonLd(movie: {
  tmdbId: number;
  title: string;
  overview?: string | null;
  releaseYear?: number | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  imdbId?: string | null;
  runtime?: number;
  genres?: string[];
  director?: { name: string } | null;
  cast?: Array<{ name: string }>;
}) {
  const canonicalUrl = new URL(`/movies/${toMovieSlug(movie.title, movie.releaseYear)}`, getAppUrl()).toString();
  const imageUrl = movie.backdropUrl
    ? getLargeImage(movie.backdropUrl, "backdrop")
    : movie.posterUrl
      ? getLargeImage(movie.posterUrl, "poster")
      : undefined;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.title,
    description: movie.overview ?? undefined,
    image: imageUrl,
    datePublished: movie.releaseYear ? `${movie.releaseYear}-01-01` : undefined,
    url: canonicalUrl,
  };

  if (movie.imdbId) schema.sameAs = `https://www.imdb.com/title/${movie.imdbId}/`;
  if (movie.genres?.length) schema.genre = movie.genres;
  if (typeof movie.runtime === "number" && movie.runtime > 0) schema.duration = `PT${movie.runtime}M`;
  if (movie.director?.name) schema.director = { "@type": "Person", name: movie.director.name };
  if (movie.cast?.length) schema.actor = movie.cast.slice(0, 5).map((p) => ({ "@type": "Person", name: p.name }));

  const identifiers: Array<Record<string, unknown>> = [
    { "@type": "PropertyValue", propertyID: "TMDB", value: String(movie.tmdbId) },
  ];
  if (movie.imdbId) identifiers.push({ "@type": "PropertyValue", propertyID: "IMDB", value: movie.imdbId });
  schema.identifier = identifiers;

  return schema;
}
