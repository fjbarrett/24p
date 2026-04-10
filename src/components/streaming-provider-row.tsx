"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AMAZON_ICON, STREAMING_ICONS, iconForeground, type StreamingIconData } from "@/lib/streaming-icons";

type Provider = {
  id: number;
  name: string;
  logoUrl: string;
};

type DirectOffer = {
  url: string;
  accessModel: "subscription" | "free" | "ads" | "live" | "rent" | "buy" | "cinema";
  providerName: string;
  providerShortName: string;
  lookupKeys: string[];
  iconUrl?: string | null;
  presentationType?: string | null;
  price?: number | null;
};

type StreamingProviderRowProps = {
  tmdbId: number;
  title: string;
  imdbId?: string | null;
  releaseYear?: number;
  mediaType?: "movie" | "tv";
};

type DisplayProvider = {
  id: string;
  href: string | null;
  icon?: StreamingIconData;
  logoUrl: string;
  name: string;
};

const APPLE_TV_PLUS_ID = 350;

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

function normalizeProviderKey(value: string | number): string {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getBrandOverride(href: string | null): Pick<DisplayProvider, "icon" | "name"> | null {
  if (!href || !isAmazonUrl(href)) return null;
  return { icon: AMAZON_ICON, name: "Amazon Prime Video" };
}

function possibleProviderKeys(provider: Provider): string[] {
  const keys = new Set<string>([
    normalizeProviderKey(provider.id),
    normalizeProviderKey(provider.name),
  ]);
  const normalizedName = provider.name.trim().toLowerCase();

  if (isAmazonProvider(provider.name)) {
    keys.add(normalizeProviderKey("Amazon Prime Video"));
    keys.add(normalizeProviderKey("Prime Video"));
    keys.add(normalizeProviderKey("Amazon"));
    keys.add(normalizeProviderKey("amp"));
  }

  if (normalizedName.includes("plex")) {
    keys.add(normalizeProviderKey("Plex"));
    keys.add(normalizeProviderKey("plx"));
    keys.add(normalizeProviderKey("Plex Player"));
    keys.add(normalizeProviderKey("pxp"));
    keys.add(normalizeProviderKey("Plex Channel"));
    keys.add(normalizeProviderKey("plc"));
  }

  if (normalizedName.includes("pluto")) {
    keys.add(normalizeProviderKey("Pluto TV"));
    keys.add(normalizeProviderKey("plutotv"));
    keys.add(normalizeProviderKey("ptv"));
  }

  if (normalizedName.includes("tubi")) {
    keys.add(normalizeProviderKey("Tubi TV"));
    keys.add(normalizeProviderKey("tubitv"));
    keys.add(normalizeProviderKey("tbv"));
  }

  return [...keys];
}

function isPlexProvider(provider: Provider) {
  return provider.name.trim().toLowerCase().includes("plex");
}

function offerPriority(offer: DirectOffer): number {
  switch (offer.accessModel) {
    case "subscription":
      return 0;
    case "free":
      return 1;
    case "ads":
      return 2;
    case "live":
      return 3;
    case "rent":
      return 4;
    case "buy":
      return 5;
    case "cinema":
      return 6;
    default:
      return 99;
  }
}

function isPlayableOffer(offer: DirectOffer) {
  return offer.accessModel === "subscription"
    || offer.accessModel === "free"
    || offer.accessModel === "ads"
    || offer.accessModel === "live";
}

function getDirectOffer(provider: Provider, directOffers: DirectOffer[]): DirectOffer | null {
  const keys = new Set(possibleProviderKeys(provider));
  const matches = directOffers
    .filter((offer) => isPlayableOffer(offer) && offer.lookupKeys.some((key) => keys.has(key)));

  const filteredMatches = isPlexProvider(provider)
    ? matches.filter((offer) => offer.accessModel === "free")
    : matches;

  filteredMatches.sort((a, b) => offerPriority(a) - offerPriority(b));
  return filteredMatches[0] ?? null;
}

function dedupeProviderKey(href: string | null, providerId: number): string {
  if (!href) return `provider:${providerId}`;
  if (isAmazonUrl(href)) return "provider:amazon";
  return normalizeHref(href);
}

function buildDisplayProviders(
  providers: Provider[],
  directOffers: DirectOffer[],
): DisplayProvider[] {
  const seen = new Set<string>();

  return providers.flatMap((provider) => {
    const directOffer = getDirectOffer(provider, directOffers);
    const href = directOffer?.url ?? null;

    if (isAmazonUrl(directOffer?.url ?? null) && !isAmazonProvider(provider.name)) {
      return [];
    }

    if (!href || (isPlexProvider(provider) && !directOffer)) return [];

    const override = getBrandOverride(directOffer?.url ?? null);
    const dedupeKey = dedupeProviderKey(href, provider.id);

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

function buildOfferDisplayProviders(directOffers: DirectOffer[]): DisplayProvider[] {
  const bestByProvider = new Map<string, DirectOffer>();

  for (const offer of directOffers) {
    if (!isPlayableOffer(offer)) continue;
    if (offer.providerShortName === "plx" && offer.accessModel !== "free") continue;

    const key = normalizeProviderKey(offer.providerShortName || offer.providerName);
    const current = bestByProvider.get(key);
    if (!current || offerPriority(offer) < offerPriority(current)) {
      bestByProvider.set(key, offer);
    }
  }

  return [...bestByProvider.entries()].flatMap(([key, offer]) => {
    const override = getBrandOverride(offer.url);
    if (!override && !offer.iconUrl) {
      return [];
    }

    return [{
      id: `offer:${key}`,
      href: offer.url,
      icon: override?.icon,
      logoUrl: offer.iconUrl ?? "",
      name: override?.name ?? offer.providerName,
    }];
  });
}

function mergeDisplayProviders(primary: DisplayProvider[], fallback: DisplayProvider[]) {
  const merged: DisplayProvider[] = [];
  const seen = new Set<string>();

  for (const provider of [...primary, ...fallback]) {
    const key = normalizeProviderKey(provider.name);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(provider);
  }

  return merged;
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

export function StreamingProviderRow({ tmdbId, title, imdbId, releaseYear, mediaType = "movie" }: StreamingProviderRowProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [directOffers, setDirectOffers] = useState<DirectOffer[]>([]);
  const [appleTvUrl, setAppleTvUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const providersFetch = fetch(`/api/watch-providers?tmdbId=${tmdbId}&mediaType=${mediaType}&includeAppleTvPlus=1`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setProviders(data.providers ?? []);
      })
      .catch(() => {});

    const yearParam = releaseYear ? `&year=${releaseYear}` : "";
    const linksFetch = fetch(`/api/watch-links?title=${encodeURIComponent(title)}${yearParam}&mediaType=${mediaType}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setDirectOffers(Array.isArray(data) ? (data as DirectOffer[]) : []);
      })
      .catch(() => {});

    const appleFetch = imdbId
      ? fetch(`/api/apple-tv?${new URLSearchParams({ imdbId, title }).toString()}`)
          .then((response) => (response.ok ? response.json() : null))
          .then((data) => {
            if (!active || !data?.url) return;
            setAppleTvUrl(data.url as string);
          })
          .catch(() => {})
      : Promise.resolve();

    void Promise.all([providersFetch, linksFetch, appleFetch]);

    return () => {
      active = false;
    };
  }, [imdbId, mediaType, releaseYear, title, tmdbId]);

  const hasAppleTvPlusProvider = providers.some((provider) => provider.id === APPLE_TV_PLUS_ID);
  const fallbackAppleSearchUrl = hasAppleTvPlusProvider
    ? `https://tv.apple.com/us/search?term=${encodeURIComponent(title)}`
    : null;
  const effectiveAppleTvUrl = appleTvUrl ?? fallbackAppleSearchUrl;
  const tmdbDisplayProviders = buildDisplayProviders(
    providers.filter((provider) => provider.id !== APPLE_TV_PLUS_ID),
    directOffers,
  );
  const offerDisplayProviders = buildOfferDisplayProviders(directOffers);
  const displayProviders = mergeDisplayProviders(tmdbDisplayProviders, offerDisplayProviders);
  if (!displayProviders.length && !effectiveAppleTvUrl) return null;

  return (
    <div className="w-full max-w-[720px] py-2">
      {(effectiveAppleTvUrl || displayProviders.length) ? (
        <div className="flex items-center justify-center gap-3">
          {effectiveAppleTvUrl ? (
            <a
              href={effectiveAppleTvUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Watch on Apple TV"
              title="Apple TV"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-white transition-opacity hover:opacity-75"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-black" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
            </a>
          ) : null}
          {displayProviders.map((provider) => (
            <ProviderIcon key={provider.id} provider={provider} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
