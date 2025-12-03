import { CreateListButton } from "@/components/create-list-button";
import { ListGallery } from "@/components/list-gallery";
import { ImportListModal } from "@/components/import-list-modal";
import { SignInButton } from "@/components/sign-in-button";
import { TmdbSearchBar } from "@/components/tmdb-search-bar";
import { loadLists } from "@/lib/list-store";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  const lists = userEmail ? await loadLists(userEmail) : [];

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10 text-black-100 sm:px-8 lg:px-16">
        <div className="w-full flex items-center justify-center">
          <Header isSignedIn={false} centered />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-10 text-black-100 sm:px-8 lg:px-16">
      <div className="mx-auto max-w-[1000px] space-y-14">
        <Header isSignedIn />

        <main className="space-y-12">
          <div className="grid gap-8 lg:grid-cols-[3fr,2fr]">
            <SearchSection />
          </div>

          <div className="space-y-6 rounded-3xl bg-black-900/30 p-6 backdrop-blur" id="lists">
            <CreateListButton userEmail={userEmail} />
            <ListGallery lists={lists} />
          </div>
        </main>
      </div>
    </div>
  );
}

function Header({ isSignedIn, centered = false }: { isSignedIn: boolean; centered?: boolean }) {
  const layoutClass = centered
    ? "flex flex-col items-center gap-4 text-center"
    : "flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center";
  return (
    <header
      className={`${layoutClass} rounded-3xl border border-white/5 bg-black-900/40 px-6 py-5 shadow-xl shadow-neutral-900/20`}
    >
      <div>
        <p className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">24p</p>
      </div>
      <div className={`flex flex-wrap gap-2 ${centered ? "justify-center" : ""}`}>
        {isSignedIn && <ImportListModal />}
        <SignInButton />
      </div>
    </header>
  );
}

function SearchSection() {
  return (
    <div>
        <TmdbSearchBar />
    </div>
  );
}
