"use client";

import type { MouseEvent, ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

type BackButtonProps = {
  fallbackHref: string;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
};

const subscribe = () => () => {};

export function BackButton({ fallbackHref, className, ariaLabel, children }: BackButtonProps) {
  const router = useRouter();
  const hasHistory = useSyncExternalStore(
    subscribe,
    () => window.history.length > 1,
    () => false,
  );

  if (!hasHistory) return null;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;

    event.preventDefault();
    router.back();
  };

  return (
    <a href={fallbackHref} onClick={handleClick} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  );
}

