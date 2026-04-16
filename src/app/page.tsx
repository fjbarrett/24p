import { ListsSection } from "@/components/lists-section";
import { SignInButton } from "@/components/sign-in-button";
import { SignOutIconButton } from "@/components/sign-out-icon-button";
import { TmdbSearchBar } from "@/components/tmdb-search-bar";
import type { SavedList } from "@/lib/list-store";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { NotebookText, Settings, User } from "@/components/icons";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { listListsForUser } from "@/lib/server/lists";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = (await getServerSession(authOptions)) as Session | null;
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  const lists = userEmail ? await listListsForUser(userEmail, true) : [];
  const isSignedIn = Boolean(session);

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-8 text-black-100 sm:px-6">
      {!isSignedIn ? (
        <div className="absolute right-4 top-8 z-10 sm:right-6">
          <SignInButton ariaLabel="Sign in with Google" className="px-5 py-2 text-sm" />
        </div>
      ) : null}
      <div className={`mx-auto flex w-full flex-col items-center ${isSignedIn ? "max-w-[900px]" : "max-w-[1280px] -translate-y-16"}`}>
        <Header isSignedIn={isSignedIn} centered={!session} lists={lists} userEmail={userEmail} />

        {session ? (
          <main className="mt-0 w-full max-w-[760px] space-y-10">
            <ListsSection lists={lists} userEmail={userEmail} />
          </main>
        ) : null}

        {session ? (
          <footer className="mb-6 mt-10 flex items-center justify-center gap-3">
            <Link
              href="/changelog"
              aria-label="Changelog"
              title="Changelog"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 text-sm text-white/75 transition hover:bg-white/10 hover:text-white active:scale-[0.98]"
            >
              <NotebookText className="h-4 w-4" strokeWidth={2.1} />
              <span>Changelog</span>
            </Link>
            <Link
              href="/profile"
              aria-label="Profile"
              title="Profile"
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/75 transition hover:bg-white/8 hover:text-white active:scale-[0.98]"
            >
              <User className="h-4 w-4" strokeWidth={2.25} />
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              title="Settings"
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/75 transition hover:bg-white/8 hover:text-white active:scale-[0.98]"
            >
              <Settings className="h-4 w-4" strokeWidth={2.25} />
            </Link>
            <SignOutIconButton />
          </footer>
        ) : null}
      </div>
    </div>
  );
}

function Header({
  isSignedIn,
  centered = false,
  lists,
  userEmail,
}: {
  isSignedIn: boolean;
  centered?: boolean;
  lists: SavedList[];
  userEmail: string;
}) {
  const layoutClass = centered
    ? "flex w-full flex-col items-center gap-8 text-center lg:gap-12"
    : "flex w-full flex-col items-center gap-6 text-center";
  return (
    <header className={`${layoutClass} relative`}>
      <div className="space-y-2 text-center">
        <p
          className={`${isSignedIn ? "text-[2.6rem] sm:text-5xl" : "text-6xl sm:text-7xl"} font-semibold leading-none text-white`}
        >
          24p
        </p>
      </div>
      <div className={`w-full ${isSignedIn ? "max-w-[560px]" : "max-w-[480px]"}`}>
        <TmdbSearchBar lists={lists} userEmail={userEmail} bordered />
      </div>
      <div className="flex justify-center">
        <Link
          href="/streaming"
          className="text-sm text-white/62 underline-offset-4 transition hover:text-white hover:underline"
        >
          Streaming Availability
        </Link>
      </div>
    </header>
  );
}
