import { ListsSection } from "@/components/lists-section";
import { PressableLogo } from "@/components/pressable-logo";
import { SignInButton } from "@/components/sign-in-button";
import { SignOutIconButton } from "@/components/sign-out-icon-button";
import { TmdbSearchBar } from "@/components/tmdb-search-bar";
import { loadLists } from "@/lib/list-store";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { Settings, User } from "lucide-react";
import Image from "next/image";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = (await getServerSession(authOptions)) as Session | null;
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  const lists = userEmail ? await loadLists(userEmail) : [];

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
    <div className="min-h-screen px-4 py-8 text-black-100 sm:px-6">
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
  lists: Awaited<ReturnType<typeof loadLists>>;
  userEmail: string;
}) {
  const layoutClass = centered
    ? "flex flex-col items-center gap-3 text-center"
    : "flex w-full flex-col items-center gap-4 text-center";
  return (
    <header
      className={`${layoutClass} relative`}
    >
      <div className="flex items-center justify-center">
        {isSignedIn ? (
          <PressableLogo src="/icon-24p.png" alt="24p logo" width={219} height={192} />
        ) : (
          <Image
            src="/icon-24p.png"
            alt="24p logo"
            width={219}
            height={192}
            priority
            loading="eager"
            className="mt-[15px] h-[192px] w-[219px] rounded-[10px]"
          />
        )}
      </div>
      {!isSignedIn ? (
        <SignInButton ariaLabel="Sign in with Google" className="mt-4 px-5 py-2 text-sm" />
      ) : null}
      {isSignedIn && (
        <div className="w-full max-w-[560px]">
          <TmdbSearchBar lists={lists} userEmail={userEmail} />
        </div>
      )}
    </header>
  );
}
