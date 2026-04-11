"use client";

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
    <header className="flex min-h-[64px] items-center gap-3 px-4 py-4 sm:px-6">
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
      className="shrink-0 whitespace-nowrap text-base text-white/70 transition hover:text-white"
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
