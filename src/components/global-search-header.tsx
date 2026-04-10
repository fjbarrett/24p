import { Suspense } from "react";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listListsForUser } from "@/lib/server/lists";
import { TmdbSearchBar } from "@/components/tmdb-search-bar";
import { GlobalHeaderClient } from "@/components/global-header-client";

async function GlobalHeaderContent() {
  const session = (await getServerSession(authOptions)) as Session | null;
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  const lists = userEmail ? await listListsForUser(userEmail, true) : [];

  return (
    <GlobalHeaderClient>
      <TmdbSearchBar lists={lists} userEmail={userEmail} />
    </GlobalHeaderClient>
  );
}

export function GlobalSearchHeader() {
  return (
    <Suspense fallback={null}>
      <GlobalHeaderContent />
    </Suspense>
  );
}
