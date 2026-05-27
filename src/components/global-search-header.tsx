import { Suspense } from "react";
import { getSessionUserEmail } from "@/lib/server/session";
import { listListsForUser } from "@/lib/server/lists";
import { TmdbSearchBar } from "@/components/tmdb-search-bar";
import { GlobalHeaderClient } from "@/components/global-header-client";

async function GlobalHeaderContent() {
  const userEmail = (await getSessionUserEmail()) ?? "";
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
