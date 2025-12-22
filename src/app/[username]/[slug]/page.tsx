import Link from "next/link";
import { notFound } from "next/navigation";
import { getListByUsernameSlug, loadFavorites } from "@/lib/list-store";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRatingsForUser } from "@/lib/ratings-store";
import { ListSortControls } from "@/components/list-sort-controls";
import { ListDetailClient } from "@/components/list-detail-client";
import { FavoriteToggle } from "@/components/favorite-toggle";

export const dynamic = "force-dynamic";

export default async function ListDetail({
  params,
  searchParams,
}: {
  params: Promise<{ username: string; slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined> | URLSearchParams>;
}) {
  const [{ username, slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
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
  const list = await getListByUsernameSlug(username, slug, viewerEmail);

  if (!list) {
    notFound();
  }

  const ratingsMap = viewerEmail ? await getRatingsForUser(viewerEmail) : {};
  const favorites = viewerEmail ? await loadFavorites(viewerEmail) : [];
  const isFavorite = favorites.some((entry) => entry.id === list.id);
  const headerGradient = pickGradient(list);
  const fromParam = encodeURIComponent(`/${list.username ?? username}/${list.slug}`);

  return (
    <div className="text-black-100">
      <div className="mx-auto max-w-[1000px] space-y-6 rounded-3xl bg-black-900/70 p-6 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between">
          <Link href="/" className="rounded-full px-4 py-2 text-sm text-black-200">
            <span>Back</span>
          </Link>
          {viewerEmail && (
            <FavoriteToggle listId={list.id} userEmail={viewerEmail} initialFavorite={isFavorite} />
          )}
        </div>
        <div className="h-28 rounded-2xl border border-white/5 bg-gradient-to-br from-black-900 via-black-950 to-black-900 overflow-hidden relative">
          <div
            className="absolute inset-0 rounded-2xl opacity-90"
            style={{ background: headerGradient, mixBlendMode: "lighten" }}
            aria-hidden
          />
          <div className="relative z-10 flex h-full items-center justify-between px-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-black-400">
                {list.username ? `@${list.username}` : `@${username}`}
              </p>
              <h1 className="text-3xl font-semibold text-white">{list.title}</h1>
            </div>
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
