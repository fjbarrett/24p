import Image from "next/image";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { fetchTmdbShow, resolveTvSlug } from "@/lib/server/tmdb";
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

async function resolveToShow(slug: string) {
  const legacyId = parseLegacyNumericSlug(slug);
  if (legacyId !== null) {
    const show = await fetchTmdbShow(legacyId);
    permanentRedirect(`/tv/${toMovieSlug(show.title, show.releaseYear)}`);
  }
  const tmdbId = await resolveTvSlug(slug);
  if (!tmdbId) return null;
  return fetchTmdbShow(tmdbId);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const show = await resolveToShow(slug);
    if (!show) return { title: "TV Show", robots: { index: false, follow: false } };

    const canonical = `/tv/${toMovieSlug(show.title, show.releaseYear)}`;
    const title = typeof show.releaseYear === "number" ? `${show.title} (${show.releaseYear})` : show.title;
    const description = show.overview?.trim() ? show.overview : `Details for ${show.title} on 24p.`;
    const imageUrl = show.backdropUrl
      ? getLargeImage(show.backdropUrl, "backdrop")
      : show.posterUrl
        ? getLargeImage(show.posterUrl, "poster")
        : null;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        ...(imageUrl ? { images: [{ url: imageUrl, alt: `${show.title} poster` }] } : {}),
      },
      twitter: {
        title,
        description,
        ...(imageUrl ? { images: [imageUrl] } : {}),
      },
    };
  } catch {
    return { title: "TV Show", robots: { index: false, follow: false } };
  }
}

export default async function TvShowDetailPage({ params }: PageProps) {
  const [{ slug }, session] = await Promise.all([params, getServerSession(authOptions)]);

  const show = await resolveToShow(slug);
  if (!show) notFound();

  const canonical = toMovieSlug(show.title, show.releaseYear);
  if (slug !== canonical) redirect(`/tv/${canonical}`);

  const typedSession = session as Session | null;
  const userEmail = typedSession?.user?.email?.toLowerCase() ?? "";
  const jsonLd = buildShowJsonLd(show);

  return (
    <div className="flex min-h-screen flex-col items-center bg-black text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <div className="mx-auto w-full max-w-[800px] px-6 py-8 sm:px-10">
        <MovieTrailerToggle
          tmdbId={show.tmdbId}
          title={show.title}
          posterUrl={show.posterUrl ? getLargeImage(show.posterUrl, "poster") : null}
          backdropUrl={show.backdropUrl ? getLargeImage(show.backdropUrl, "backdrop") : null}
          trailerEndpoint={`/tmdb/tv/${show.tmdbId}/trailer`}
        />

        <h1
          className="mt-3 text-center text-2xl font-semibold tracking-tight !text-white"
          style={{ color: "#fff", WebkitTextFillColor: "#fff", opacity: 1 }}
        >
          {show.title}
          {typeof show.releaseYear === "number" ? (
            <span className="ml-2 font-normal text-[#888]">({show.releaseYear})</span>
          ) : null}
        </h1>

        {typeof show.imdbRating === "number" ? (
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-[#B3B3B3]">
            {typeof show.imdbRating === "number" && show.imdbId ? (
              <a
                href={`https://www.imdb.com/title/${show.imdbId}/`}
                target="_blank"
                rel="noreferrer"
                className="ml-2 flex items-center gap-1 transition hover:opacity-70"
              >
                <Image src="/imdb_logo.svg" alt="IMDb" width={32} height={16} className="h-4 w-auto opacity-90" unoptimized />
                <span>{show.imdbRating}</span>
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex justify-center">
          <StreamingProviderRow
            tmdbId={show.tmdbId}
            title={show.title}
            imdbId={show.imdbId}
            releaseYear={show.releaseYear}
            mediaType="tv"
          />
        </div>

        {show.overview ? (
          <div className="mt-4 w-full">
            <DescriptionExpander text={show.overview} />
          </div>
        ) : null}

        {(userEmail || show.imdbId) ? (
          <MovieActions
            tmdbId={show.tmdbId}
            userEmail={userEmail}
            imdbId={show.imdbId}
            title={show.title}
            releaseYear={show.releaseYear}
            mediaType="tv"
          />
        ) : null}
      </div>
    </div>
  );
}

function getLargeImage(url: string, type: "poster" | "backdrop"): string {
  if (!url.includes("/w185/")) return url;
  return url.replace("/w185/", type === "backdrop" ? "/w1280/" : "/w780/");
}

function buildShowJsonLd(show: {
  tmdbId: number;
  title: string;
  overview?: string | null;
  releaseYear?: number | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  imdbId?: string | null;
  genres?: string[];
}) {
  const canonicalUrl = new URL(`/tv/${toMovieSlug(show.title, show.releaseYear)}`, getAppUrl()).toString();
  const imageUrl = show.backdropUrl
    ? getLargeImage(show.backdropUrl, "backdrop")
    : show.posterUrl
      ? getLargeImage(show.posterUrl, "poster")
      : undefined;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: show.title,
    description: show.overview ?? undefined,
    image: imageUrl,
    startDate: show.releaseYear ? `${show.releaseYear}-01-01` : undefined,
    url: canonicalUrl,
  };

  if (show.imdbId) schema.sameAs = `https://www.imdb.com/title/${show.imdbId}/`;
  if (show.genres?.length) schema.genre = show.genres;

  const identifiers: Array<Record<string, unknown>> = [
    { "@type": "PropertyValue", propertyID: "TMDB", value: String(show.tmdbId) },
  ];
  if (show.imdbId) identifiers.push({ "@type": "PropertyValue", propertyID: "IMDB", value: show.imdbId });
  schema.identifier = identifiers;

  return schema;
}
