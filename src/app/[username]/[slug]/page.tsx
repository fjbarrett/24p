import Link from "next/link";
import { notFound } from "next/navigation";
import type { SavedList } from "@/lib/list-store";
import { getSessionUserEmail } from "@/lib/server/session";
import { ListDetailClient } from "@/components/list-detail-client";
import { FavoriteToggle } from "@/components/favorite-toggle";
import type { Metadata } from "next";
import { getPublicProfileByUsername } from "@/lib/server/profiles";
import { getRatingsMapForUser } from "@/lib/server/ratings";
import { getListByUsernameSlugForViewer, getListPreviewItems, loadFavoritesForUser } from "@/lib/server/lists";
import { serializeJsonLd } from "@/lib/json-ld";
import { getAppUrl } from "@/lib/app-url";
import { toMovieSlug } from "@/lib/slug";
import { ShareButton } from "@/components/share-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}): Promise<Metadata> {
  const { username, slug } = await params;
  const viewerEmail = await getSessionUserEmail();
  const publicList = await getListByUsernameSlugForViewer(username, slug, viewerEmail);

  if (!publicList) {
    return {
      title: "List",
      robots: { index: false, follow: false },
    };
  }

  const owner = publicList.username ?? username;
  const count = publicList.movies.length;
  const previewItems = await getListPreviewItems(publicList, 20);
  const sampleTitles = previewItems.slice(0, 3).map((item) => item.title);
  const title = `${publicList.title} — @${owner}`;
  const description =
    sampleTitles.length > 0
      ? `${count} ${count === 1 ? "film" : "films"} curated by @${owner} on 24p, including ${sampleTitles.join(", ")}. See where to stream them.`
      : `${count} ${count === 1 ? "film" : "films"} curated by @${owner} on 24p. See where to stream them.`;
  const canonical = `/${encodeURIComponent(owner)}/${encodeURIComponent(publicList.slug)}`;

  return {
    title,
    description,
    alternates: { canonical },
    // The poster-collage image comes from opengraph-image.tsx automatically.
    openGraph: { title, description, url: canonical, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ListDetail({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;
  const viewerEmail = await getSessionUserEmail();
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

  const canonical = `/${encodeURIComponent(ownerUsername)}/${encodeURIComponent(list.slug)}`;
  const shareUrl = new URL(canonical, getAppUrl()).toString();
  const previewItems = await getListPreviewItems(list, 20);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: list.title,
    description: `${list.movies.length} films curated by @${ownerUsername} on 24p.`,
    url: shareUrl,
    numberOfItems: list.movies.length,
    itemListElement: previewItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      url: new URL(
        `${item.mediaType === "tv" ? "/tv" : "/movies"}/${toMovieSlug(item.title, item.year)}`,
        getAppUrl(),
      ).toString(),
    })),
  };

  return (
    <div className="min-h-screen text-black-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <article className="mx-auto mt-4 w-full max-w-[900px] space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="relative mb-2">
          <div className="relative z-10 space-y-3 px-5 pb-0 pt-3 text-center sm:px-6 sm:pt-4">
            <h1 className="text-4xl font-semibold leading-[1.05] text-white sm:text-5xl">{list.title}</h1>
            <div className="mb-1 flex flex-wrap items-center justify-center gap-1.5 text-sm text-black-400 opacity-70">
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
            <div className="flex items-center justify-center gap-3 pb-4">
              <ShareButton url={shareUrl} title={list.title} />
              {canFavorite && (
                <div className="opacity-70">
                  <FavoriteToggle listId={list.id} userEmail={viewerEmail} initialFavorite={isFavorite} />
                </div>
              )}
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

