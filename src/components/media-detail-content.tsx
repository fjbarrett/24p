import Image from "next/image";
import Link from "next/link";
import type { SimplifiedMovie } from "@/lib/tmdb";
import { MovieActions } from "@/components/movie-actions";
import { DescriptionExpander } from "@/components/description-expander";
import { MovieTrailerToggle } from "@/components/movie-trailer-toggle";
import { StreamingProviderRow } from "@/components/streaming-provider-row";
import { serializeJsonLd } from "@/lib/json-ld";
import { getLargeImage, buildMediaJsonLd } from "@/lib/media";
import { toArtistSlug } from "@/lib/slug";

type MediaDetailContentProps = {
  media: SimplifiedMovie;
  mediaType: "movie" | "tv";
  userEmail: string;
  trailerEndpoint?: string;
};

export function MediaDetailContent({
  media,
  mediaType,
  userEmail,
  trailerEndpoint,
}: MediaDetailContentProps) {
  const jsonLd = buildMediaJsonLd(media, mediaType === "movie" ? "/movies" : "/tv");

  return (
    <div className="flex min-h-screen flex-col items-center bg-black text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <div className="mx-auto w-full max-w-[800px] px-6 py-8 sm:px-10">
        <MovieTrailerToggle
          tmdbId={media.tmdbId}
          title={media.title}
          posterUrl={media.posterUrl ? getLargeImage(media.posterUrl, "poster") : null}
          backdropUrl={media.backdropUrl ? getLargeImage(media.backdropUrl, "backdrop") : null}
          trailerEndpoint={trailerEndpoint}
        />

        <h1 className="mt-6 mb-3 text-center text-2xl font-semibold tracking-tight text-white">
          {media.title}
          {typeof media.releaseYear === "number" ? (
            <span className="ml-2 font-normal text-white/50">({media.releaseYear})</span>
          ) : null}
        </h1>

        {typeof media.imdbRating === "number" && media.imdbId ? (
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-white/70">
            <a
              href={`https://www.imdb.com/title/${media.imdbId}/`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 transition hover:opacity-70"
            >
              <Image src="/imdb_logo.svg" alt="IMDb" width={32} height={16} className="h-4 w-auto opacity-90" unoptimized />
              <span>{media.imdbRating}</span>
            </a>
          </div>
        ) : null}

        <div className="mt-3 flex justify-center">
          <StreamingProviderRow
            tmdbId={media.tmdbId}
            title={media.title}
            imdbId={media.imdbId}
            releaseYear={media.releaseYear}
            mediaType={mediaType === "tv" ? "tv" : undefined}
          />
        </div>

        {media.cast && media.cast.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/60">
            {media.cast.slice(0, 5).map((person) => (
              <Link
                key={person.tmdbId}
                href={`/artists/${toArtistSlug(person.name)}`}
                className="transition hover:text-white"
              >
                {person.name}
              </Link>
            ))}
          </div>
        ) : null}

        {media.overview ? (
          <div className="mt-4 w-full">
            <DescriptionExpander text={media.overview} />
          </div>
        ) : null}

        {(userEmail || media.imdbId) ? (
          <MovieActions
            tmdbId={media.tmdbId}
            userEmail={userEmail}
            imdbId={media.imdbId}
            title={media.title}
            releaseYear={media.releaseYear}
            mediaType={mediaType === "tv" ? "tv" : undefined}
          />
        ) : null}
      </div>
    </div>
  );
}
