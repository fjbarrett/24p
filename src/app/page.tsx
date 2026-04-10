import { ListsSection } from "@/components/lists-section";
import { SignInButton } from "@/components/sign-in-button";
import { SignOutIconButton } from "@/components/sign-out-icon-button";
import { TmdbSearchBar } from "@/components/tmdb-search-bar";
import type { SavedList } from "@/lib/list-store";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { Settings, User } from "lucide-react";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { listListsForUser } from "@/lib/server/lists";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = (await getServerSession(authOptions)) as Session | null;
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  const lists = userEmail ? await listListsForUser(userEmail, true) : [];

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10 text-black-100 sm:px-8 lg:px-16">
        <div className="flex w-full flex-col items-center justify-center gap-10">
          <Header isSignedIn={false} centered lists={[]} userEmail="" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 text-black-100 sm:px-6">
      <div className="mx-auto flex w-full max-w-[900px] flex-col items-center">
        <Header isSignedIn lists={lists} userEmail={userEmail} />

        <main className="mt-0 w-full max-w-[760px] space-y-10">
          <ListsSection lists={lists} userEmail={userEmail} />
        </main>

        <footer className="mb-6 mt-10 flex items-center justify-center gap-3">
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
    ? "flex flex-col items-center gap-3 text-center"
    : "flex w-full flex-col items-center gap-4 text-center";
  return (
    <header
      className={`${layoutClass} relative`}
    >
      <div className="space-y-1 text-center">
        <p
          className={`${isSignedIn ? "text-[2.6rem] sm:text-5xl" : "text-6xl sm:text-7xl"} font-semibold leading-none text-white`}
        >
          24p
        </p>
      </div>
      {!isSignedIn ? (
        <SignInButton ariaLabel="Sign in with Google" className="mt-4 px-5 py-2 text-sm" />
      ) : null}
      {isSignedIn && (
        <div className="w-full max-w-[560px] space-y-3">
          <TmdbSearchBar lists={lists} userEmail={userEmail} />
          <div className="flex justify-center">
            <Link
              href="/streaming"
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/72 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
            >
              Streaming On
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
