import Link from "next/link";
import { notFound } from "next/navigation";
import { ListGallery } from "@/components/list-gallery";
import { loadPublicListsForUsername } from "@/lib/list-store";
import { getPublicProfile } from "@/lib/profile-store";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) {
    return {
      title: "Not found",
      robots: { index: false, follow: false },
    };
  }

  const handle = `@${profile.username}`;
  const description = `Public lists by ${handle} on 24p.`;

  return {
    title: handle,
    description,
    alternates: { canonical: `/${encodeURIComponent(profile.username)}` },
    openGraph: {
      title: handle,
      description,
      url: `/${encodeURIComponent(profile.username)}`,
    },
    twitter: {
      title: handle,
      description,
    },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getPublicProfile(username);

  if (!profile) {
    notFound();
  }

  const lists = await loadPublicListsForUsername(profile.username, 48);

  return (
    <div className="min-h-screen px-4 py-8 text-black-100 sm:px-8 lg:px-16">
      <div className="mx-auto w-full max-w-[1000px] space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-black-400">Public profile</p>
            <h1 className="text-3xl font-semibold text-white">@{profile.username}</h1>
          </div>
          <Link
            href="/"
            className="rounded-full bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-black transition hover:brightness-95 active:brightness-90"
          >
            Back
          </Link>
        </header>
        <ListGallery
          lists={lists}
          title="Public Lists"
          id="public-lists"
          emptyMessage="No public lists yet."
        />
      </div>
    </div>
  );
}
