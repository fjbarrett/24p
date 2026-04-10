import Image from "next/image";
import { fetchTmdbShow } from "@/lib/server/tmdb";
import { MovieActions } from "@/components/movie-actions";
import { BackButton } from "@/components/back-button";
import { DescriptionExpander } from "@/components/description-expander";
import { MovieTrailerToggle } from "@/components/movie-trailer-toggle";
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
  if (Number.isNaN(tmdbId)) return { title: "TV Show" };

  try {
    const show = await fetchTmdbShow(tmdbId);
    const title = typeof show.releaseYear === "number" ? `${show.title} (${show.releaseYear})` : show.title;
    const description = show.overview?.trim() ? show.overview : `Details for ${show.title} on 24p.`;
    const canonical = `/tv/${show.tmdbId}`;
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
    return {
      title: "TV Show",
      alternates: { canonical: `/tv/${tmdbId}` },
      robots: { index: false, follow: false },
    };
  }
}

export default async function TvShowDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, resolvedSearchParams, session] = await Promise.all([
    params,
    searchParams,
    getServerSession(authOptions),
  ]);
  const tmdbId = Number(id);
  if (Number.isNaN(tmdbId)) throw new Error("Invalid TMDB id");

  const typedSession = session as Session | null;
  const userEmail = typedSession?.user?.email?.toLowerCase() ?? "";
  const show = await fetchTmdbShow(tmdbId);
  const backHref = getFromParam(resolvedSearchParams) ?? "/";
  const jsonLd = buildShowJsonLd(show);

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

      <div className="mx-auto w-full max-w-[800px] px-6 py-8 sm:px-10">
        <MovieTrailerToggle
          tmdbId={show.tmdbId}
          title={show.title}
          posterUrl={show.posterUrl ? getLargeImage(show.posterUrl, "poster") : null}
          backdropUrl={show.backdropUrl ? getLargeImage(show.backdropUrl, "backdrop") : null}
          trailerEndpoint={`/tmdb/tv/${show.tmdbId}/trailer`}
        />

        <h1 className="mt-3 text-center text-2xl text-white">{show.title}</h1>

        {(typeof show.releaseYear === "number" || typeof show.imdbRating === "number") ? (
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-sm text-[#B3B3B3]">
            {typeof show.releaseYear === "number" ? <span>{show.releaseYear}</span> : null}
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
          </p>
        ) : null}

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
}) {
  const canonicalUrl = new URL(`/tv/${show.tmdbId}`, getAppUrl()).toString();
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
  if (show.imdbId) {
    schema.sameAs = `https://www.imdb.com/title/${show.imdbId}/`;
  }
  return schema;
}
