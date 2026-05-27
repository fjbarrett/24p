import { notFound, permanentRedirect, redirect } from "next/navigation";
import { fetchTmdbShow, resolveTvSlug } from "@/lib/server/tmdb";
import { MediaDetailContent } from "@/components/media-detail-content";
import { getSessionUserEmail } from "@/lib/server/session";
import { buildMediaMetadata } from "@/lib/media";
import { toMovieSlug, parseLegacyNumericSlug } from "@/lib/slug";
import type { Metadata } from "next";

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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const show = await resolveToShow(slug);
    if (!show) return { title: "TV Show", robots: { index: false, follow: false } };
    return buildMediaMetadata(show, "/tv", "TV Show");
  } catch {
    return { title: "TV Show", robots: { index: false, follow: false } };
  }
}

export default async function TvShowDetailPage({ params }: PageProps) {
  const [{ slug }, userEmail] = await Promise.all([params, getSessionUserEmail()]);

  const show = await resolveToShow(slug);
  if (!show) notFound();

  const canonical = toMovieSlug(show.title, show.releaseYear);
  if (slug !== canonical) redirect(`/tv/${canonical}`);

  return (
    <MediaDetailContent
      media={show}
      mediaType="tv"
      userEmail={userEmail ?? ""}
      trailerEndpoint={`/tmdb/tv/${show.tmdbId}/trailer`}
    />
  );
}
