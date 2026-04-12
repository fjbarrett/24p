"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// useLayoutEffect on the server emits a warning; this silences it while
// preserving synchronous behaviour on the client (where it matters).
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const STORAGE_PREFIX = "scroll:";

function buildKey(pathname: string, search: string) {
  if (!search) return `${STORAGE_PREFIX}${pathname}`;
  return `${STORAGE_PREFIX}${pathname}?${search}`;
}

function readScroll(key: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeScroll(key: string, value: number) {
  try {
    window.sessionStorage.setItem(key, String(Math.max(0, Math.floor(value))));
  } catch {
    // ignore sessionStorage write failures (Safari private mode, quota, etc)
  }
}

export function ScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shouldRestoreOnNextPath = useRef(false);
  const lastScrollY = useRef(0);
  const scrollRaf = useRef<number | null>(null);
  // Track the previous pathname so we can distinguish a real page change
  // (needs scroll-to-top) from a search-param-only update (preserve scroll).
  const prevPathnameRef = useRef(pathname);

  const key = useMemo(() => {
    const search = searchParams.toString();
    return buildKey(pathname, search);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handlePopState = () => {
      shouldRestoreOnNextPath.current = true;
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Scroll to top synchronously (before paint) on forward navigation so the
  // new page never briefly appears at the previous page's scroll position.
  // Back/forward browser navigation is excluded — the useEffect below will
  // restore the saved position for those instead.
  useIsomorphicLayoutEffect(() => {
    if (!shouldRestoreOnNextPath.current) {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  useEffect(() => {
    prevPathnameRef.current = pathname;

    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      if (scrollRaf.current !== null) return;
      scrollRaf.current = window.requestAnimationFrame(() => {
        scrollRaf.current = null;
        lastScrollY.current = window.scrollY;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    if (shouldRestoreOnNextPath.current) {
      // Back/forward browser navigation — restore the saved position.
      shouldRestoreOnNextPath.current = false;
      const stored = readScroll(key);
      if (typeof stored === "number") {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo(0, stored);
          });
        });
      }
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollRaf.current !== null) {
        window.cancelAnimationFrame(scrollRaf.current);
        scrollRaf.current = null;
      }
      writeScroll(key, lastScrollY.current);
    };
  }, [key, pathname]);

  return null;
}
