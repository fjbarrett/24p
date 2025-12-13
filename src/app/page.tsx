import { ListsSection } from "@/components/lists-section";
import { SignInButton } from "@/components/sign-in-button";
import { TmdbSearchBar } from "@/components/tmdb-search-bar";
import { loadLists } from "@/lib/list-store";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import Image from "next/image";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = (await getServerSession(authOptions)) as Session | null;
  const userEmail = session?.user?.email?.toLowerCase() ?? "";
  const lists = userEmail ? await loadLists(userEmail) : [];

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10 text-black-100 sm:px-8 lg:px-16">
        <div className="w-full flex items-center justify-center">
          <Header isSignedIn={false} centered lists={[]} userEmail="" />
        </div>
      </div>
    );
  }

  return (
    <div className="text-black-100">
      <div className="mx-auto max-w-[1000px]">
        <Header isSignedIn lists={lists} userEmail={userEmail} />

        <main className="space-y-10">
          <ListsSection lists={lists} userEmail={userEmail} />
        </main>

        <footer className="flex justify-center mb-6">
          <SignInButton className="px-5 py-2 text-sm" ariaLabel="Sign out" />
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
          <Image
            src="/icon-new.png"
            alt="24p logo"
            width={192}
            // height={192}
            priority
            loading="eager"
            className="mt-10 h-[192px] w-[192px] rounded-[10px]"
          />
        ) : (
          <SignInButton
            variant="ghost"
            borderless
            className="mt-[15px] rounded-[12px] p-0 border-none hover:border-none focus-visible:outline-white active:translate-y-[1px] active:scale-[0.99] transition"
            ariaLabel="Sign in with Google"
          >
            <Image
              src="/icon-new.png"
              alt="24p logo"
              width={128}
              height={128}
              priority
              loading="eager"
              className="h-[128px] w-[128px] rounded-[10px] transition hover:opacity-90"
            />
          </SignInButton>
        )}
      </div>
      {isSignedIn && (
        <div className="w-full max-w-[560px]">
          <TmdbSearchBar lists={lists} userEmail={userEmail} />
        </div>
      )}
    </header>
  );
}
