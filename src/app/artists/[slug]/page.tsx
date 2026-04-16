import Image from "next/image";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import type { FilmographyEntry, SimplifiedArtist } from "@/lib/tmdb";
import { FilmographyRoleFilter } from "./filmography-role-filter";
import type { Metadata } from "next";
import { fetchTmdbPersonWithFilmography, resolvePersonSlug } from "@/lib/server/tmdb";
import { serializeJsonLd } from "@/lib/json-ld";
import { getAppUrl } from "@/lib/app-url";
import { toArtistSlug, parseLegacyNumericSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";

type PersonResponse = {
  person: SimplifiedArtist;
  filmography: FilmographyEntry[];
};

async function resolveToPerson(slug: string): Promise<PersonResponse | null> {
  const legacyId = parseLegacyNumericSlug(slug);
  if (legacyId !== null) {
    const payload = await fetchTmdbPersonWithFilmography(legacyId);
    permanentRedirect(`/artists/${toArtistSlug(payload.person.name)}`);
  }
  const tmdbId = await resolvePersonSlug(slug);
  if (!tmdbId) return null;
  try {
    return await fetchTmdbPersonWithFilmography(tmdbId);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const payload = await resolveToPerson(slug);
    if (!payload) return { title: "Not found", robots: { index: false, follow: false } };

    const canonical = `/artists/${toArtistSlug(payload.person.name)}`;
    const title = `${payload.person.name} — Filmography`;
    const description = `Filmography for ${payload.person.name} on 24p.`;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        ...(payload.person.profileUrl ? { images: [{ url: payload.person.profileUrl, alt: payload.person.name }] } : {}),
      },
      twitter: {
        title,
        description,
        ...(payload.person.profileUrl ? { images: [payload.person.profileUrl] } : {}),
      },
    };
  } catch {
    return { title: "Artist", robots: { index: false, follow: false } };
  }
}

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const payload = await resolveToPerson(slug);
  if (!payload) notFound();

  const { person, filmography } = payload;

  const canonical = toArtistSlug(person.name);
  if (slug !== canonical) redirect(`/artists/${canonical}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    url: new URL(`/artists/${canonical}`, getAppUrl()).toString(),
    ...(person.profileUrl ? { image: person.profileUrl } : {}),
  };

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-white sm:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="mx-auto w-full max-w-[1000px] space-y-8">
        <header className="flex items-center gap-5">
          {person.profileUrl ? (
            <Image
              src={person.profileUrl}
              alt={person.name}
              width={80}
              height={80}
              className="h-20 w-20 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs text-white/40">
              No photo
            </div>
          )}
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-white">{person.name}</h1>
            {person.knownFor.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {person.knownFor.map((item) => (
                  <span key={item} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-white/60">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        </header>

        <FilmographyRoleFilter filmography={filmography} />
      </div>
    </div>
  );
}
