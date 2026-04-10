import Link from "next/link";
import { notFound } from "next/navigation";
import type { SavedList } from "@/lib/list-store";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ListDetailClient } from "@/components/list-detail-client";
import { FavoriteToggle } from "@/components/favorite-toggle";
import type { Metadata } from "next";
import { BackButton } from "@/components/back-button";
import { getPublicProfileByUsername } from "@/lib/server/profiles";
import { getRatingsMapForUser } from "@/lib/server/ratings";
import { getListByUsernameSlugForViewer, loadFavoritesForUser } from "@/lib/server/lists";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}): Promise<Metadata> {
  const { username, slug } = await params;
  const session = (await getServerSession(authOptions)) as Session | null;
  const viewerEmail = session?.user?.email?.toLowerCase() ?? null;
  const publicList = await getListByUsernameSlugForViewer(username, slug, viewerEmail);

  if (!publicList) {
    return {
      title: "List",
      robots: { index: false, follow: false },
    };
  }

  const owner = publicList.username ?? username;
  const title = `${publicList.title} — @${owner}`;
  const description = `${publicList.movies.length} films in this 24p list.`;
  const canonical = `/${encodeURIComponent(owner)}/${encodeURIComponent(publicList.slug)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
    twitter: { title, description },
  };
}

export default async function ListDetail({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;
  const session = (await getServerSession(authOptions)) as Session | null;
  const viewerEmail = session?.user?.email?.toLowerCase() ?? null;
  const list = await getListByUsernameSlugForViewer(username, slug, viewerEmail);

  if (!list) {
    notFound();
  }

  const ownerUsername = list.username ?? username;
  const publicProfile = ownerUsername ? await getPublicProfileByUsername(ownerUsername) : null;
  const ownerIsPublic = !!publicProfile?.isPublic;
  const ratingsMap: Record<number, number> = viewerEmail ? await getRatingsMapForUser(viewerEmail) : {};
  const favorites: SavedList[] = viewerEmail ? await loadFavoritesForUser(viewerEmail) : [];
  const isFavorite = favorites.some((entry) => entry.id === list.id);
  const fromParam = encodeURIComponent(`/${ownerUsername}/${list.slug}`);
  const canFavorite = !!viewerEmail && viewerEmail !== list.userEmail;
  const isOwner = !!viewerEmail && viewerEmail === list.userEmail;

  return (
    <div className="min-h-screen text-black-100">
      <div className="mx-auto w-full max-w-[900px] px-6 pt-6 sm:px-8">
        <div className="flex items-center justify-between">
          {viewerEmail ? (
            <BackButton
              fallbackHref="/"
              className="text-sm text-white/70 transition hover:text-white"
            >
              ← Back
            </BackButton>
          ) : <div />}
          {canFavorite && <FavoriteToggle listId={list.id} userEmail={viewerEmail} initialFavorite={isFavorite} />}
        </div>
      </div>
      <article className="mx-auto w-full max-w-[900px] space-y-6 rounded-[28px] bg-black-900/70 p-4 shadow-2xl backdrop-blur sm:p-6 lg:p-8 mt-3">
        <div className="relative overflow-hidden rounded-[28px] bg-black-950">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black-900/60 via-black-950/70 to-black-950" />
          <div className="relative z-10 space-y-3 px-5 pb-0 pt-6 text-center sm:px-6 sm:pt-7">
            <h1 className="text-4xl font-semibold leading-[1.05] text-white sm:text-5xl">{list.title}</h1>
            <div className="mb-1 flex flex-wrap items-center justify-center gap-1.5 text-sm text-black-400">
              {ownerIsPublic ? (
                <Link
                  href={`/${encodeURIComponent(ownerUsername)}`}
                  className="inline-flex items-center rounded-full bg-black-900 px-2.5 py-1 font-medium text-black-200 hover:text-white"
                >
                  @{ownerUsername}
                </Link>
              ) : (
                <span className="inline-flex items-center rounded-full bg-black-900 px-2.5 py-1 font-medium text-black-200">
                  @{ownerUsername}
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-black-900 px-2.5 py-1 font-medium text-black-100">
                {list.movies.length} {list.movies.length === 1 ? "film" : "films"}
              </span>
              <span className="inline-flex items-center rounded-full bg-black-900 px-2.5 py-1 font-medium text-black-200">
                {list.visibility === "public" ? "Public list" : "Private list"}
              </span>
              {list.canEdit && viewerEmail && viewerEmail !== list.userEmail ? (
                <span className="inline-flex items-center rounded-full bg-black-900 px-2.5 py-1 font-medium text-black-200">
                  Shared with you
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="!mt-0">
          <ListDetailClient
            list={list}
            viewerEmail={viewerEmail}
            ratingsMap={ratingsMap}
            fromParam={fromParam}
          />
        </div>
      </article>
    </div>
  );
}

