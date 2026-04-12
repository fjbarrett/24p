"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

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

  useEffect(() => {
    const pathnameChanged = prevPathnameRef.current !== pathname;
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
    } else if (pathnameChanged) {
      // Forward navigation to a new page — always start at the top.
      // (Search-param-only updates on the same path are left alone.)
      window.scrollTo(0, 0);
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
