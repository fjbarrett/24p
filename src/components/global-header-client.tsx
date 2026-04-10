"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";

const DETAIL_PATHS = ["/movies/", "/tv/", "/artists/"];
const subscribe = () => () => {};

export function GlobalHeaderClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/") return null;

  const isDetailPage = DETAIL_PATHS.some((p) => pathname.startsWith(p));

  return (
    <header className="flex items-center gap-3 px-4 pt-4 sm:px-6">
      {isDetailPage ? <BackControl /> : <BrandLink />}
      <div className="min-w-0 flex-1">{children}</div>
    </header>
  );
}

function BackControl() {
  const router = useRouter();
  const hasHistory = useSyncExternalStore(
    subscribe,
    () => window.history.length > 1,
    () => false,
  );

  if (!hasHistory) return <BrandLink />;

  return (
    <button
      onClick={() => router.back()}
      className="shrink-0 whitespace-nowrap text-sm text-white/70 transition hover:text-white"
    >
      ← Back
    </button>
  );
}

function BrandLink() {
  return (
    <Link href="/" className="shrink-0 text-base font-semibold text-white">
      24p
    </Link>
  );
}
