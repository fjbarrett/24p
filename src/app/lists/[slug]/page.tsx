import Image from "next/image";
import Link from "next/link";
import { getListBySlug } from "@/lib/list-store";
import type { SimplifiedMovie } from "@/lib/tmdb";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRatingsForUser } from "@/lib/ratings-store";
import { ListSortControls } from "@/components/list-sort-controls";
import { ListDetailClient } from "@/components/list-detail-client";

export const dynamic = "force-dynamic";

export default async function ListDetail({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined> | URLSearchParams>;
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const session = (await getServerSession(authOptions)) as Session | null;
  const viewerEmail = session?.user?.email?.toLowerCase() ?? null;
  const sort =
    resolvedSearchParams instanceof URLSearchParams
      ? resolvedSearchParams.get("sort")
      : (() => {
          const sortParam = resolvedSearchParams?.sort;
          return Array.isArray(sortParam) ? sortParam[0] : sortParam;
        })();
  const dir =
    resolvedSearchParams instanceof URLSearchParams
      ? resolvedSearchParams.get("dir")
      : (() => {
          const dirParam = (resolvedSearchParams as { dir?: string | string[] | undefined })?.dir;
          return Array.isArray(dirParam) ? dirParam[0] : dirParam;
        })();
  const list = viewerEmail ? await getListBySlug(slug, viewerEmail) : undefined;

  if (!list) {
    return (
      <div className="text-black-100">
        <div className="mx-auto max-w-2xl rounded-3xl bg-black-900/40 p-8 text-center">
          <p className="text-sm text-black-400">List not found.</p>
          <Link href="/" className="mt-4 inline-flex rounded-full border border-black-600 px-5 py-2 text-sm text-black-200">
            Return home
          </Link>
        </div>
      </div>
    );
  }

  const ratingsMap = viewerEmail ? await getRatingsForUser(viewerEmail) : {};
  const fromParam = encodeURIComponent(`/lists/${list.slug}`);
  const headerGradient = pickGradient(list);

  return (
    <div className="text-black-100">
      <div className="mx-auto max-w-[1000px] space-y-6 rounded-3xl bg-black-900/70 p-6 shadow-2xl backdrop-blur">
        <div className="flex justify-left">
          <Link href="/" className="rounded-full px-4 py-2 text-sm text-black-200">
            {/* <span aria-hidden>⟵</span> */}
            <span>Back</span>
          </Link>
        </div>
        <div className="h-28 rounded-2xl border border-white/5 bg-gradient-to-br from-black-900 via-black-950 to-black-900 overflow-hidden relative">
          <div
            className="absolute inset-0 rounded-2xl opacity-90"
            style={{ background: headerGradient, mixBlendMode: "lighten" }}
            aria-hidden
          />
          <div className="relative z-10 flex h-full items-center px-5">
            <h1 className="text-3xl font-semibold text-white">{list.title}</h1>
          </div>
        </div>
        <ListSortControls sort={sort} dir={dir} />
        <ListDetailClient
          list={list}
          viewerEmail={viewerEmail}
          ratingsMap={ratingsMap}
          sort={sort}
          dir={dir}
          fromParam={fromParam}
        />
      </div>
    </div>
  );
}

function sortMoviesByRating(
  movies: SimplifiedMovie[],
  ratingsMap: Record<number, number>,
  originalOrder: number[],
) {
  if (!movies.length) return movies;

  const position = new Map<number, number>();
  originalOrder.forEach((tmdbId, index) => position.set(tmdbId, index));

  const getScore = (movie: SimplifiedMovie) => {
    const userRating = ratingsMap[movie.tmdbId];
    if (typeof userRating === "number") return userRating;
    if (typeof movie.rating === "number") return movie.rating;
    return -Infinity;
  };

  return [...movies].sort((a, b) => {
    const scoreDelta = getScore(b) - getScore(a);
    if (scoreDelta !== 0) return scoreDelta;
    const indexA = position.get(a.tmdbId) ?? Number.MAX_SAFE_INTEGER;
    const indexB = position.get(b.tmdbId) ?? Number.MAX_SAFE_INTEGER;
    return indexA - indexB;
  });
}

function getLargePoster(url: string): string {
  return url.includes("/w500/")
    ? url.replace("/w500/", "/w185/")
    : url.includes("/w342/")
      ? url.replace("/w342/", "/w185/")
      : url;
}

const rainbowStops = [
  "#ff7be0",
  "#b37cff",
  "#4d9cff",
  "#7bdcb5",
  "#f6c343",
  "#ff9f43",
  "#ff6b6b",
  "#ff7be0",
];

function pickGradient(list: { id: string; slug?: string; title?: string }) {
  const key = list.slug || list.title || list.id;
  const shift = Array.from(key).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % rainbowStops.length, 0);
  const rotated = [...rainbowStops.slice(shift), ...rainbowStops.slice(0, shift)];
  return `linear-gradient(90deg, ${rotated.join(", ")})`;
}
