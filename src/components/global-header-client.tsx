"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { House } from "@/components/icons";

const subscribe = () => () => {};

export function GlobalHeaderClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/") return null;

  const isDetailPage = pathname.split("/").filter(Boolean).length >= 2;

  return (
    <header className="flex min-h-[44px] items-center gap-2.5 px-4 py-1.5 sm:px-6">
      <div className="min-w-[3rem] shrink-0">
        {isDetailPage ? <DetailNav /> : <BrandLink />}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </header>
  );
}

function DetailNav() {
  const router = useRouter();
  const hasHistory = useSyncExternalStore(
    subscribe,
    () => window.history.length > 1,
    () => false,
  );

  // Home is always available on detail pages; Back only when there's somewhere
  // to go back to (e.g. a fresh tab opened straight onto a title has no history).
  return (
    <div className="flex items-center gap-3">
      {hasHistory ? (
        <button
          onClick={() => router.back()}
          className="shrink-0 whitespace-nowrap text-sm text-white/70 transition hover:text-white"
        >
          ← Back
        </button>
      ) : null}
      <Link
        href="/"
        aria-label="Home"
        className="flex shrink-0 items-center text-white/70 transition hover:text-white"
      >
        <House className="h-[18px] w-[18px]" />
      </Link>
    </div>
  );
}

function BrandLink() {
  return (
    <Link href="/" className="shrink-0 text-sm font-semibold text-white">
      24p
    </Link>
  );
}
