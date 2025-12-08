import { ListsSection } from "@/components/lists-section";
import { SignInButton } from "@/components/sign-in-button";
import { TmdbSearchBar } from "@/components/tmdb-search-bar";
import { loadLists } from "@/lib/list-store";
import { getServerSession } from "next-auth";
import Image from "next/image";
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
    <div className="text-black-100">
      <div className="mx-auto max-w-[1000px] space-y-8">
        <Header isSignedIn />

        <main className="space-y-10">
          <ListsSection lists={lists} userEmail={userEmail} />
        </main>
      </div>
    </div>
  );
}

function Header({ isSignedIn, centered = false }: { isSignedIn: boolean; centered?: boolean }) {
  const layoutClass = centered
    ? "flex flex-col items-center gap-3 text-center"
    : "flex w-full flex-col items-center gap-4 text-center";
  return (
    <header
      className={`${layoutClass} relative`}
    >
      {isSignedIn && (
        <div style={{ marginTop: 15 }}  className="flex w-full justify-center">
          <SignInButton className="px-5 py-2 text-sm" ariaLabel="Sign out" />
        </div>
      )}
      <div className="flex items-center justify-center">
        {isSignedIn ? (
          <Image src="/icon-new.png" alt="24p logo" width={192} height={192} className="rounded-[10px]" />
        ) : (
          <SignInButton
            variant="ghost"
            borderless
            className="rounded-[12px] p-0 border-none hover:border-none focus-visible:outline-white active:translate-y-[1px] active:scale-[0.99] transition"
            ariaLabel="Sign in with Google"
          >
            <Image
              src="/icon-new.png"
              alt="24p logo"
              width={128}
              height={128}
              className="rounded-[10px] transition hover:opacity-90"
            />
          </SignInButton>
        )}
      </div>
      {isSignedIn && (
        <div className="w-full max-w-[560px]">
          <TmdbSearchBar />
        </div>
      )}
    </header>
  );
}
