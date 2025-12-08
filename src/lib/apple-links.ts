import "server-only";

type CheapChartsPayload = {
  productPageUrl?: string | null;
  itunesUrl?: string | null;
  price?: string | null;
};

const DEFAULT_STRAWBERRY_BASE_URL =
  process.env.NODE_ENV === "development" ? "https://strawberry.fjbarrett.workers.dev" : "";

function getStrawberryBaseUrl() {
  const candidate =
    process.env.STRAWBERRY_BASE_URL ??
    process.env.NEXT_PUBLIC_STRAWBERRY_BASE_URL ??
    DEFAULT_STRAWBERRY_BASE_URL;
  return candidate.replace(/\/$/, "");
}

export async function fetchAppleTvLink(
  imdbId: string,
  title: string,
): Promise<{ url: string | null; price: string | null }> {
  const base = getStrawberryBaseUrl();
  if (!base) {
    return { url: null, price: null };
  }

  const url = new URL("/cheapcharts", base);
  url.searchParams.set("imdbID", imdbId);
  url.searchParams.set("title", title);

  try {
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return { url: null, price: null };
    }
    const data = (await response.json()) as CheapChartsPayload;
    const link = data.productPageUrl ?? data.itunesUrl ?? null;
    const price =
      data.price && data.price.length > 0 ? (data.price.startsWith("$") ? data.price : `$${data.price}`) : null;
    return { url: link, price };
  } catch {
    return { url: null, price: null };
  }
}
