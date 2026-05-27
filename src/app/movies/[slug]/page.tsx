import { notFound, permanentRedirect, redirect } from "next/navigation";
import { fetchTmdbMovie } from "@/lib/tmdb-server";
import { resolveMovieSlug } from "@/lib/server/tmdb";
import { MediaDetailContent } from "@/components/media-detail-content";
import { getSessionUserEmail } from "@/lib/server/session";
import { buildMediaMetadata } from "@/lib/media";
import { toMovieSlug, parseLegacyNumericSlug } from "@/lib/slug";
import type { Metadata } from "next";

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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const movie = await resolveToMovie(slug);
    if (!movie) return { title: "Movie", robots: { index: false, follow: false } };
    return buildMediaMetadata(movie, "/movies", "Movie");
  } catch {
    return { title: "Movie", robots: { index: false, follow: false } };
  }
}

export default async function MovieDetailPage({ params }: PageProps) {
  const [{ slug }, userEmail] = await Promise.all([params, getSessionUserEmail()]);

  const movie = await resolveToMovie(slug);
  if (!movie) notFound();

  const canonical = toMovieSlug(movie.title, movie.releaseYear);
  if (slug !== canonical) redirect(`/movies/${canonical}`);

  return (
    <MediaDetailContent
      media={movie}
      mediaType="movie"
      userEmail={userEmail ?? ""}
    />
  );
}
