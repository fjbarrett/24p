import Link from "next/link";
import { CreateListButton } from "@/components/create-list-button";
import { ListGallery } from "@/components/list-gallery";
import { SignInButton } from "@/components/sign-in-button";
import { StatsBar } from "@/components/stats-bar";
import { TmdbSearchBar } from "@/components/tmdb-search-bar";
import { loadLists } from "@/lib/list-store";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const showHero = !session;
  const lists = await loadLists();

  return (
    <div className="px-4 py-10 text-slate-100 sm:px-8 lg:px-16">
      <div className="mx-auto max-w-6xl space-y-14">
        <Header />

        <main className="space-y-16">
          <SearchSection />

          {showHero && <HeroSection />}

          <CreateListButton />
          <ListGallery lists={lists} />
        </main>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-white/5 bg-slate-900/40 px-6 py-5 shadow-xl shadow-sky-500/5 sm:flex-row sm:items-center">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">24p</p>
        <p className="text-sm text-slate-500">Plan watchlists, invite friends, and keep every rating in sync.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="#lists" className="rounded-full px-4 py-2 text-sm text-slate-300 transition hover:text-white">
          Lists
        </Link>
        <Link href="#auth" className="rounded-full px-4 py-2 text-sm text-slate-300 transition hover:text-white">
          Google auth
        </Link>
        <SignInButton />
      </div>
    </header>
  );
}

function SearchSection() {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 shadow-lg">
      <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Search TMDB</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Find a movie, then drop it straight into your next 24p list.</h1>
      <p className="text-sm text-slate-400">Use the search below to pull posters, runtimes, and genres directly from TMDB.</p>
      <div className="mt-6">
        <TmdbSearchBar />
      </div>
    </section>
  );
}

function HeroSection() {
  return (
    <section className="space-y-10 rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/70 to-slate-950/70 p-8 shadow-2xl">
      <span className="inline-flex rounded-full border border-sky-400/40 px-4 py-1 text-xs uppercase tracking-[0.4em] text-sky-200">
        Connect. Curate. Share.
      </span>
      <div className="space-y-4">
        <h2 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
          24p brings your movie diary, curated lists, and Google account into one web app.
        </h2>
        <p className="text-lg text-slate-300">
          Sign in with Google, drop 1–10 ratings, build collaborative shelves, and broadcast the lists that define your taste.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <SignInButton className="text-base" />
        <Link
          href="#lists"
          className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white transition hover:border-white"
        >
          Browse demo lists
        </Link>
      </div>
      <StatsBar />
    </section>
  );
}
