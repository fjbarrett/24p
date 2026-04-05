"use client";

import { useState } from "react";
import Image from "next/image";
import { AMAZON_ICON, STREAMING_ICONS, iconForeground, type StreamingIconData } from "@/lib/streaming-icons";

type Provider = {
  id: number;
  name: string;
  logoUrl: string;
};

type WatchButtonProps = {
  appleTvUrl?: string | null;
  providers: Provider[];
  justWatchLink: string | null;
  directUrls?: Record<number, string>;
};

type DisplayProvider = {
  id: string;
  href: string | null;
  icon?: StreamingIconData;
  logoUrl: string;
  name: string;
};

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "tag",
  "source",
]);

function normalizeHref(href: string): string {
  try {
    const url = new URL(href);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key) || key.startsWith("utm_")) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    return url.toString();
  } catch {
    return href;
  }
}

function getBrandOverride(href: string | null): Pick<DisplayProvider, "icon" | "name"> | null {
  if (!href) return null;

  try {
    const hostname = new URL(href).hostname.toLowerCase();
    if (hostname.includes("primevideo.") || hostname.includes("amazon.") || hostname.includes("amzn.to")) {
      return { icon: AMAZON_ICON, name: "Amazon Prime Video" };
    }
  } catch {
    return null;
  }

  return null;
}

function isAmazonUrl(href: string | null): boolean {
  if (!href) return false;

  try {
    const hostname = new URL(href).hostname.toLowerCase();
    return hostname.includes("primevideo.") || hostname.includes("amazon.") || hostname.includes("amzn.to");
  } catch {
    return false;
  }
}

function isAmazonProvider(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized.includes("amazon") || normalized.includes("prime video");
}

function dedupeProviderKey(href: string | null, providerName: string, providerId: number): string {
  if (!href) return `provider:${providerId}`;
  if (isAmazonUrl(href)) return "provider:amazon";
  return normalizeHref(href);
}

function buildDisplayProviders(
  providers: Provider[],
  justWatchLink: string | null,
  directUrls: Record<number, string>,
): DisplayProvider[] {
  const seen = new Set<string>();

  return providers.flatMap((provider) => {
    const directUrl = directUrls[provider.id] ?? null;
    const href = directUrl ?? justWatchLink;

    // Drop Amazon channel marketplace links for non-Amazon providers.
    if (isAmazonUrl(directUrl) && !isAmazonProvider(provider.name)) {
      return [];
    }

    const override = getBrandOverride(directUrl);
    const dedupeKey = dedupeProviderKey(href, provider.name, provider.id);

    if (seen.has(dedupeKey)) return [];
    seen.add(dedupeKey);

    return [{
      id: `${provider.id}:${dedupeKey}`,
      href,
      icon: override?.icon ?? STREAMING_ICONS[provider.id],
      logoUrl: provider.logoUrl,
      name: override?.name ?? provider.name,
    }];
  });
}

function ProviderIcon({ provider }: { provider: DisplayProvider }) {
  const icon = provider.icon;

  if (icon) {
    const fg = iconForeground(icon.hex);
    return (
      <a
        href={provider.href ?? undefined}
        target="_blank"
        rel="noreferrer"
        aria-label={`Watch on ${provider.name}`}
        title={provider.name}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md transition-opacity hover:opacity-75"
        style={{ backgroundColor: `#${icon.hex}` }}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" style={{ fill: fg }}>
          <path d={icon.path} />
        </svg>
      </a>
    );
  }

  // Fallback: TMDB image at w92 for better sharpness
  const hiResUrl = provider.logoUrl.replace("/w45/", "/w92/");
  return (
    <a
      href={provider.href ?? undefined}
      target="_blank"
      rel="noreferrer"
      aria-label={`Watch on ${provider.name}`}
      title={provider.name}
      className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-md transition-opacity hover:opacity-75"
    >
      <Image src={hiResUrl} alt={provider.name} width={24} height={24} className="h-6 w-6 object-cover" unoptimized />
    </a>
  );
}

export function WatchButton({ appleTvUrl, providers, justWatchLink, directUrls = {} }: WatchButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const displayProviders = buildDisplayProviders(providers, justWatchLink, directUrls);

  const totalItems = displayProviders.length + (appleTvUrl ? 1 : 0);
  if (totalItems === 0) return <div className="h-11 w-11" />;

  const expandedWidth = 8 + 28 + 8 + totalItems * 32 + 8;

  return (
    <div
      className="relative h-11 flex-shrink-0 overflow-hidden rounded-full bg-white transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{ width: expanded ? expandedWidth : 44 }}
    >
      {/* TV icon — collapsed trigger */}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="See where to watch"
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-150"
        style={{ opacity: expanded ? 0 : 1, transitionDelay: expanded ? '0ms' : '200ms', pointerEvents: expanded ? 'none' : 'auto' }}
      >
        <svg viewBox="0 0 20 20" className="h-[18px] w-[18px] fill-black" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h11A2.5 2.5 0 0 1 18 4.5v8a2.5 2.5 0 0 1-2.5 2.5H12l.5 1.5H14a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1 0-1.5h1.5L8 15H4.5A2.5 2.5 0 0 1 2 12.5v-8ZM4.5 3.5A1 1 0 0 0 3.5 4.5v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-11Z" />
        </svg>
      </button>

      {/* Expanded content */}
      <div
        className="absolute inset-0 flex items-center px-2 transition-opacity duration-150"
        style={{ opacity: expanded ? 1 : 0, transitionDelay: expanded ? '180ms' : '0ms', pointerEvents: expanded ? 'auto' : 'none' }}
      >
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="shrink-0 text-sm text-black/40 transition hover:text-black"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="flex flex-1 items-center justify-center gap-2">
          {displayProviders.map((provider) => (
            <ProviderIcon key={provider.id} provider={provider} />
          ))}

          {appleTvUrl && (
            <a
              href={appleTvUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Watch on Apple TV"
              title="Apple TV"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-black transition-opacity hover:opacity-75"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
