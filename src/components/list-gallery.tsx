import Image from "next/image";
import Link from "next/link";
import type { SavedList } from "@/lib/list-store";
import { fetchTmdbMovies } from "@/lib/tmdb-server";
import { getListColorStyles } from "@/lib/list-colors";

type ListGalleryProps = {
  lists: SavedList[];
};

export async function ListGallery({ lists }: ListGalleryProps) {
  if (!lists.length) {
    return (
      <section id="lists" className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Lists</p>
        <p className="mt-2 text-sm text-slate-500">No lists yet. Use the button above to create your first one.</p>
      </section>
    );
  }

  const posterLookup = await buildPosterLookup(lists);

  return (
    <section id="lists" className="space-y-4">
      <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Your latest lists</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {lists.map((list) => {
          const accent = getListColorStyles(list.color);
          return (
            <Link
              key={list.id}
              href={`/lists/${list.slug}`}
              className="group relative block h-64 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/30 transition hover:border-slate-400"
              style={accent.surface}
            >
              {renderPostersAsBackground(posterLookup[list.id])}
              <div className="absolute inset-0 opacity-70" style={accent.overlay} />
              <div className="absolute inset-0 bg-slate-950/40 mix-blend-multiply transition group-hover:bg-slate-950/30" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/50 to-transparent" />
              <div className="relative z-10 flex h-full flex-col justify-end p-5">
                <h3 className="text-xl font-semibold text-white group-hover:text-slate-200">{list.title}</h3>
                <p className="text-sm text-slate-300 group-hover:text-slate-200">Slug: {list.slug}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function renderPostersAsBackground(posters?: string[]) {
  if (!posters?.length) {
    return <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />;
  }

  const tiles =
    posters.length >= 4
      ? posters.slice(0, 4)
      : Array.from({ length: 4 }, (_, index) => posters[index % posters.length]);

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 scale-105 blur-sm opacity-70">
        <Image
          src={tiles[0]}
          alt=""
          fill
          sizes="(max-width: 768px) 60vw, 30vw"
          className="object-cover"
          priority
        />
      </div>
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[2px]">
        {tiles.map((posterUrl, index) => (
          <div key={posterUrl + index} className="relative overflow-hidden rounded-sm">
            <Image
              src={posterUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition duration-300 ease-out group-hover:scale-105"
              priority={index === 0}
            />
            <div className="absolute inset-0 bg-slate-950/20" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function buildPosterLookup(lists: SavedList[]) {
  const entries = await Promise.all(
    lists.map(async (list) => {
      const ids = list.movies.slice(0, 4);
      if (!ids.length) return { id: list.id, posters: [] as string[] };
      const movies = await fetchTmdbMovies(ids);
      const posters = movies
        .map((movie) => movie.posterUrl)
        .filter((url): url is string => Boolean(url))
        .slice(0, 4);
      return { id: list.id, posters };
    }),
  );
  return entries.reduce<Record<string, string[]>>((acc, entry) => {
    acc[entry.id] = entry.posters;
    return acc;
  }, {});
}
