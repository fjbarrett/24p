import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { FilmographyEntry, SimplifiedArtist } from "@/lib/tmdb";
import { rustApiFetch } from "@/lib/rust-api-client";
import { FilmographyRoleFilter } from "./filmography-role-filter";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type PersonResponse = {
  person: SimplifiedArtist;
  filmography: FilmographyEntry[];
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const personId = Number(id);
  if (!Number.isFinite(personId)) {
    return { title: "Artist" };
  }

  let payload: PersonResponse | null = null;
  try {
    payload = await rustApiFetch<PersonResponse>(`/tmdb/person/${personId}`);
  } catch {
    payload = null;
  }

  if (!payload) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }

  const title = `${payload.person.name} — Filmography`;
  const description = `Filmography for ${payload.person.name} on 24p.`;
  const canonical = `/artists/${personId}`;

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
}

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = Number(id);
  if (!Number.isFinite(personId)) {
    notFound();
  }

  let payload: PersonResponse | null = null;
  try {
    payload = await rustApiFetch<PersonResponse>(`/tmdb/person/${personId}`);
  } catch {
    payload = null;
  }

  if (!payload) {
    notFound();
  }

  const { person, filmography } = payload;

  return (
    <div className="min-h-screen px-4 py-8 text-black-100 sm:px-8 lg:px-16">
      <div className="mx-auto w-full max-w-[1000px] space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {person.profileUrl ? (
              <Image
                src={person.profileUrl}
                alt={person.name}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black-900 text-xs text-black-500">
                No art
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-black-500">Filmography</p>
              <h1 className="text-3xl font-semibold text-white">{person.name}</h1>
            </div>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/75 transition hover:bg-white/8 hover:border-white/35 hover:text-white"
          >
            Back
          </Link>
        </header>

        <FilmographyRoleFilter filmography={filmography} />
      </div>
    </div>
  );
}
