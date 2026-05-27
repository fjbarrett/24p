import { requireSessionEmail } from "@/lib/server/session";
import { getRecommendationsForUser } from "@/lib/server/recommendations";
import { RecommendationsGrid } from "@/components/recommendations-grid";
import { BackButton } from "@/components/back-button";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For You — 24p",
  robots: { index: false, follow: false },
};

export default async function RecommendationsPage() {
  const userEmail = await requireSessionEmail();
  const movies = await getRecommendationsForUser(userEmail);

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <div className="mx-auto w-full max-w-[900px] px-6 pt-6 sm:px-8">
        <BackButton fallbackHref="/" className="text-sm text-white/70 transition hover:text-white">
          ← Back
        </BackButton>
      </div>

      <div className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-8">
        <header className="mb-8 space-y-1">
          <h1 className="text-3xl font-semibold text-white">For You</h1>
          <p className="text-sm text-black-400">Based on your lists</p>
        </header>

        <RecommendationsGrid movies={movies} />
      </div>
    </div>
  );
}
