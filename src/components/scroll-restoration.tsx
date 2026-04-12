"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const STORAGE_PREFIX = "scroll:";

function readSavedScroll(pathname: string): number {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${pathname}`);
    if (!raw) return 0;
    const pos = Number.parseInt(raw, 10);
    return Number.isFinite(pos) && pos >= 0 ? pos : 0;
  } catch {
    return 0;
  }
}

function saveScroll(pathname: string, y: number) {
  try {
    sessionStorage.setItem(
      `${STORAGE_PREFIX}${pathname}`,
      String(Math.floor(y)),
    );
  } catch {
    // ignore
  }
}

export function ScrollRestoration() {
  const pathname = usePathname();
  const isBackNav = useRef(false);
  const scrollY = useRef(0);

  // Mark the next navigation as back/forward before the URL changes.
  useEffect(() => {
    const onPopState = () => {
      isBackNav.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // First line of defence: reset scroll synchronously before paint on forward
  // navigation so the new page is never briefly visible at the old position.
  useLayoutEffect(() => {
    if (!isBackNav.current) {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  // Second line of defence + back-nav restoration + scroll tracking.
  useEffect(() => {
    if (isBackNav.current) {
      // Back/forward navigation — restore whatever was saved (0 is valid).
      isBackNav.current = false;
      const pos = readSavedScroll(pathname);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          window.scrollTo(0, pos);
        }),
      );
    } else {
      // Forward navigation fallback in case useLayoutEffect missed it.
      window.scrollTo(0, 0);
    }

    // Track scroll position continuously so we can save it on leave.
    scrollY.current = window.scrollY;
    const onScroll = () => {
      scrollY.current = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      saveScroll(pathname, scrollY.current);
    };
  }, [pathname]);

  return null;
}
