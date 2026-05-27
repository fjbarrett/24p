import type { Metadata } from "next";
import Link from "next/link";
import { StreamingCatalogGrid } from "@/components/streaming-catalog-grid";
import { StreamingDiscoveryControls } from "@/components/streaming-discovery-controls";
import { buildStreamingHref, getStreamingCatalogPayload } from "@/lib/server/streaming-catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Streaming",
  robots: { index: false, follow: false },
};

type StreamingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StreamingPage({ searchParams }: StreamingPageProps) {
  const resolvedSearchParams = (await (searchParams ?? Promise.resolve({}))) as Record<
    string,
    string | string[] | undefined
  >;
  const { movies, providers, providerIcons, selectedProviders, sort, seed, page, hasNextPage } =
    await getStreamingCatalogPayload(resolvedSearchParams);

  const previousHref = page > 1 ? buildStreamingHref(selectedProviders, sort, seed, page - 1) : null;
  const nextHref = hasNextPage ? buildStreamingHref(selectedProviders, sort, seed, page + 1) : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-4 py-6 sm:px-8">
        <StreamingDiscoveryControls providers={providers} selectedProviders={selectedProviders} selectedSort={sort} />

        <StreamingCatalogGrid movies={movies} providerIcons={providerIcons} />

        <nav className="flex items-center justify-center gap-3">
          {previousHref ? (
            <Link
              href={previousHref}
              className="rounded-full bg-white/[0.06] px-4 py-2 text-sm text-white/72 transition hover:bg-white/10 hover:text-white"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-full px-4 py-2 text-sm text-white/25">Previous</span>
          )}

          <span className="text-sm text-white/50">Page {page}</span>

          {nextHref ? (
            <Link
              href={nextHref}
              className="rounded-full bg-white/[0.06] px-4 py-2 text-sm text-white/72 transition hover:bg-white/10 hover:text-white"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-full px-4 py-2 text-sm text-white/25">Next</span>
          )}
        </nav>
      </div>
    </div>
  );
}
