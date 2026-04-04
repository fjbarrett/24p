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
import { Pencil } from "lucide-react";

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
  searchParams,
}: {
  params: Promise<{ username: string; slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined> | URLSearchParams>;
}) {
  const [{ username, slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
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
  const initialEditing = getEditParam(resolvedSearchParams);
  const canFavorite = !!viewerEmail && viewerEmail !== list.userEmail;
  const isOwner = !!viewerEmail && viewerEmail === list.userEmail;

  return (
    <div className="relative min-h-screen px-4 py-6 text-black-100 sm:px-6">
      <BackButton
        fallbackHref="/"
        className="absolute left-10 top-[50px] z-20 text-sm text-white/70 transition hover:text-white"
      >
        ← Back
      </BackButton>
      <article className="mx-auto w-full max-w-[900px] space-y-6 rounded-[28px] bg-black-900/70 p-4 shadow-2xl backdrop-blur sm:p-6 lg:p-8">
        <div className="flex justify-end">
          {canFavorite && <FavoriteToggle listId={list.id} userEmail={viewerEmail} initialFavorite={isFavorite} />}
        </div>
        <div className="relative overflow-hidden rounded-[28px] bg-black-950">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black-900/60 via-black-950/70 to-black-950" />
          <div className="relative z-10 space-y-4 px-5 py-6 text-center sm:px-6 sm:py-7">
            <div className="space-y-2">
              <div className="space-y-1">
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
                <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">{list.title}</h1>
              </div>
              <div
                className="mx-auto h-[3px] w-full max-w-[220px] rounded-full opacity-70"
                style={{ background: accentColor }}
                aria-hidden
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-black-400">
              <span className="inline-flex items-center rounded-full bg-black-900 px-3 py-1.5 font-medium text-black-100">
                {list.movies.length} {list.movies.length === 1 ? "film" : "films"}
              </span>
              <span className="inline-flex items-center rounded-full bg-black-900 px-3 py-1.5 font-medium text-black-200">
                {list.visibility === "public" ? "Public list" : "Private list"}
              </span>
              {list.canEdit && viewerEmail && viewerEmail !== list.userEmail ? (
                <span className="inline-flex items-center rounded-full bg-black-900 px-3 py-1.5 font-medium text-black-200">
                  Shared with you
                </span>
              ) : null}
            </div>
            {isOwner && !initialEditing ? (
              <div className="flex justify-center pt-1">
                <Link
                  href={`/${encodeURIComponent(ownerUsername)}/${encodeURIComponent(list.slug)}?edit=1`}
                  aria-label="Edit list"
                  title="Edit list"
                  className="flex h-10 w-10 items-center justify-center text-white/75 transition hover:text-white active:scale-[0.98]"
                >
                  <Pencil className="h-4 w-4" strokeWidth={2.25} />
                </Link>
              </div>
            ) : null}
          </div>
        </div>
        <ListDetailClient
          list={list}
          viewerEmail={viewerEmail}
          ratingsMap={ratingsMap}
          fromParam={fromParam}
          initialEditing={initialEditing}
        />
      </article>
    </div>
  );
}

function getEditParam(
  search: Record<string, string | string[] | undefined> | URLSearchParams | undefined,
) {
  const raw =
    search instanceof URLSearchParams
      ? search.get("edit")
      : (() => {
          const value = search?.edit;
          return Array.isArray(value) ? value[0] : value;
        })();

  return raw === "1" || raw === "true";
}

const accentColors = ["#e864c6", "#8c63e0", "#3d7fcf", "#54c295", "#d8a534", "#e68630", "#e05555"];

function pickAccent(list: { id: string; slug?: string; title?: string }) {
  const key = list.slug || list.title || list.id;
  const shift = Array.from(key).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % accentColors.length, 0);
  return accentColors[shift];
}
