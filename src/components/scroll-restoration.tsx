"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const STORAGE_PREFIX = "scroll:";

export function ScrollRestoration() {
  const pathname = usePathname();
  const isBackNav = useRef(false);
  const scrollY = useRef(0);

  // Mark the next navigation as a back/forward event before the URL changes.
  useEffect(() => {
    const onPopState = () => {
      isBackNav.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Scroll to top synchronously (before paint) on every forward navigation.
  // Skipped for back/forward — the effect below restores the saved position.
  useLayoutEffect(() => {
    if (!isBackNav.current) {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  // Track the current scroll position, save it on leave, and restore it on
  // back/forward navigation.
  useEffect(() => {
    const key = `${STORAGE_PREFIX}${pathname}`;

    // Sync the ref in case useLayoutEffect already reset to 0.
    scrollY.current = window.scrollY;

    const onScroll = () => {
      scrollY.current = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    if (isBackNav.current) {
      isBackNav.current = false;
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const pos = Number.parseInt(raw, 10);
          if (Number.isFinite(pos) && pos > 0) {
            // Double rAF gives the page a chance to paint content before
            // jumping to the saved position.
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                window.scrollTo(0, pos);
              }),
            );
          }
        }
      } catch {
        // ignore sessionStorage errors
      }
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      try {
        sessionStorage.setItem(key, String(Math.floor(scrollY.current)));
      } catch {
        // ignore
      }
    };
  }, [pathname]);

  return null;
}
