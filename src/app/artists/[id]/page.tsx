import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { FilmographyEntry, SimplifiedArtist } from "@/lib/tmdb";
import { rustApiFetch } from "@/lib/rust-api-client";

export const dynamic = "force-dynamic";

type PersonResponse = {
  person: SimplifiedArtist;
  filmography: FilmographyEntry[];
};

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
            className="rounded-full border border-black-700 px-4 py-2 text-xs uppercase tracking-[0.3em] text-black-200 transition hover:border-white/60"
          >
            Back
          </Link>
        </header>

        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-black-500">Credits</p>
          {filmography.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {filmography.map((credit) => (
                <Link
                  key={`${credit.tmdbId}-${credit.role ?? "credit"}`}
                  href={`/movies/${credit.tmdbId}`}
                  className="flex gap-3 rounded-2xl border border-black-800 bg-black-950 p-3 transition hover:border-black-600"
                >
                  {credit.posterUrl ? (
                    <Image
                      src={credit.posterUrl}
                      alt={credit.title}
                      width={72}
                      height={108}
                      className="h-24 w-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-16 items-center justify-center rounded-xl bg-black-900 text-[10px] text-black-500">
                      No art
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-white">
                      {credit.title}
                      {credit.releaseYear ? (
                        <span className="text-xs text-black-500"> ({credit.releaseYear})</span>
                      ) : null}
                    </p>
                    {credit.role && <p className="text-xs text-black-500">{credit.role}</p>}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-black-500">No filmography found.</p>
          )}
        </section>
      </div>
    </div>
  );
}
