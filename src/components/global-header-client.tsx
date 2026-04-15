"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";

const subscribe = () => () => {};

export function GlobalHeaderClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/") return null;

  const isDetailPage = pathname.split("/").filter(Boolean).length >= 2;

  return (
    <header className="flex min-h-[44px] items-center gap-2.5 px-4 py-1.5 sm:px-6">
      <div className="min-w-[3rem] shrink-0">
        {isDetailPage ? <BackControl /> : <BrandLink />}
      </div>
      <div className="min-w-0 flex-1">
        {isDetailPage && React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<{ compact?: boolean }>, { compact: true })
          : children}
      </div>
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
    <Link href="/" className="shrink-0 text-sm font-semibold text-white">
      24p
    </Link>
  );
}
