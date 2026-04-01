import Link from "next/link";
import { notFound } from "next/navigation";
import { getListByUsernameSlug, loadFavorites } from "@/lib/list-store";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRatingsForUser } from "@/lib/ratings-store";
import { ListDetailClient } from "@/components/list-detail-client";
import { FavoriteToggle } from "@/components/favorite-toggle";
import { getPublicProfile } from "@/lib/profile-store";
import type { Metadata } from "next";
import { BackButton } from "@/components/back-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}): Promise<Metadata> {
  const { username, slug } = await params;
  const session = (await getServerSession(authOptions)) as Session | null;
  const viewerEmail = session?.user?.email?.toLowerCase() ?? null;
  const publicList = await getListByUsernameSlug(username, slug, viewerEmail);

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
  const list = await getListByUsernameSlug(username, slug, viewerEmail);

  if (!list) {
    notFound();
  }

  const ownerUsername = list.username ?? username;
  const publicProfile = ownerUsername ? await getPublicProfile(ownerUsername) : null;
  const ownerIsPublic = !!publicProfile?.isPublic;
  const ratingsMap = viewerEmail ? await getRatingsForUser(viewerEmail) : {};
  const favorites = viewerEmail ? await loadFavorites(viewerEmail) : [];
  const isFavorite = favorites.some((entry) => entry.id === list.id);
  const accentColor = pickAccent(list);
  const fromParam = encodeURIComponent(`/${ownerUsername}/${list.slug}`);

  const canFavorite = !!viewerEmail && viewerEmail !== list.userEmail;

  return (
    <div className="text-black-100">
      <div className="mx-auto max-w-[1000px] rounded-3xl bg-black-900/70 p-6 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between">
          <BackButton fallbackHref="/" className="rounded-full px-4 py-2 text-sm text-black-200">
            <span>Back</span>
          </BackButton>
          {canFavorite && (
            <FavoriteToggle listId={list.id} userEmail={viewerEmail} initialFavorite={isFavorite} />
          )}
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-black-950">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black-900/60 via-black-950/70 to-black-950" />
          <div className="relative z-10 flex items-center justify-between px-5 py-6">
            <div className="space-y-2">
              <div>
                {ownerIsPublic ? (
                  <Link
                    href={`/${encodeURIComponent(ownerUsername)}`}
                    className="text-xs uppercase tracking-[0.3em] text-black-400 hover:text-white"
                  >
                    @{ownerUsername}
                  </Link>
                ) : (
                  <p className="text-xs uppercase tracking-[0.3em] text-black-400">@{ownerUsername}</p>
                )}
                <h1 className="text-3xl font-semibold text-white">{list.title}</h1>
              </div>
              <div
                className="h-[3px] rounded-full opacity-70"
                style={{ background: accentColor }}
                aria-hidden
              />
            </div>
          </div>
        </div>
        <ListDetailClient
          list={list}
          viewerEmail={viewerEmail}
          ratingsMap={ratingsMap}
          fromParam={fromParam}
        />
      </div>
    </div>
  );
}

const accentColors = ["#e864c6", "#8c63e0", "#3d7fcf", "#54c295", "#d8a534", "#e68630", "#e05555"];

function pickAccent(list: { id: string; slug?: string; title?: string }) {
  const key = list.slug || list.title || list.id;
  const shift = Array.from(key).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % accentColors.length, 0);
  return accentColors[shift];
}
