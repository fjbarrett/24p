import type { Metadata } from "next";
import type { SimplifiedMovie } from "@/lib/tmdb";
import { getAppUrl } from "@/lib/app-url";
import { toMovieSlug } from "@/lib/slug";

export function getLargeImage(url: string, type: "poster" | "backdrop"): string {
  if (!url.includes("/w185/")) return url;
  return url.replace("/w185/", type === "backdrop" ? "/w1280/" : "/w780/");
}

export function buildMediaMetadata(
  media: SimplifiedMovie,
  routePrefix: "/movies" | "/tv",
): Metadata {
  const canonical = `${routePrefix}/${toMovieSlug(media.title, media.releaseYear)}`;
  const title =
    typeof media.releaseYear === "number"
      ? `${media.title} (${media.releaseYear})`
      : media.title;
  const description = media.overview?.trim()
    ? media.overview
    : `Details for ${media.title} on 24p.`;
  const imageUrl = media.backdropUrl
    ? getLargeImage(media.backdropUrl, "backdrop")
    : media.posterUrl
      ? getLargeImage(media.posterUrl, "poster")
      : null;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      ...(imageUrl ? { images: [{ url: imageUrl, alt: `${media.title} poster` }] } : {}),
    },
    twitter: {
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export function buildMediaJsonLd(
  media: SimplifiedMovie,
  routePrefix: "/movies" | "/tv",
) {
  const isMovie = routePrefix === "/movies";
  const canonicalUrl = new URL(
    `${routePrefix}/${toMovieSlug(media.title, media.releaseYear)}`,
    getAppUrl(),
  ).toString();
  const imageUrl = media.backdropUrl
    ? getLargeImage(media.backdropUrl, "backdrop")
    : media.posterUrl
      ? getLargeImage(media.posterUrl, "poster")
      : undefined;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": isMovie ? "Movie" : "TVSeries",
    name: media.title,
    description: media.overview ?? undefined,
    image: imageUrl,
    url: canonicalUrl,
  };

  if (isMovie) {
    schema.datePublished = media.releaseYear ? `${media.releaseYear}-01-01` : undefined;
    if (typeof media.runtime === "number" && media.runtime > 0) schema.duration = `PT${media.runtime}M`;
    if (media.director?.name) schema.director = { "@type": "Person", name: media.director.name };
    if (media.cast?.length) schema.actor = media.cast.slice(0, 5).map((p) => ({ "@type": "Person", name: p.name }));
  } else {
    schema.startDate = media.releaseYear ? `${media.releaseYear}-01-01` : undefined;
  }

  if (media.imdbId) schema.sameAs = `https://www.imdb.com/title/${media.imdbId}/`;
  if (media.genres?.length) schema.genre = media.genres;

  const identifiers: Array<Record<string, unknown>> = [
    { "@type": "PropertyValue", propertyID: "TMDB", value: String(media.tmdbId) },
  ];
  if (media.imdbId) identifiers.push({ "@type": "PropertyValue", propertyID: "IMDB", value: media.imdbId });
  schema.identifier = identifiers;

  return schema;
}
