import "server-only";

const CHEAPCHARTS_API = "https://buster.cheapcharts.de/v1/gptapi/Prices.php";
// API hard limit
const BATCH_SIZE = 5;

export type CheapChartsPrice = {
  imdbId: string;
  title: string;
  buyPriceUsd: number | null;
  currency: string;
};

type CheapChartsMovie = {
  imdbId?: string | null;
  title?: string | null;
  price?: number | null;
  currency?: string | null;
};

type CheapChartsResponse = {
  status: string;
  results?: {
    buymovies?: CheapChartsMovie[] | null;
  } | null;
};

async function fetchPriceBatch(imdbIds: string[]): Promise<CheapChartsPrice[]> {
  const url = new URL(CHEAPCHARTS_API);
  url.searchParams.set("action", "getPrices");
  url.searchParams.set("store", "itunes");
  url.searchParams.set("country", "us");
  url.searchParams.set("itemType", "buymovies");
  url.searchParams.set("imdbIDs", imdbIds.join(","));

  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "24p/1.0" },
      signal: AbortSignal.timeout(8000),
      // No caching — we always want the latest prices.
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = (await response.json()) as CheapChartsResponse;
    if (data.status !== "success") return [];

    return (data.results?.buymovies ?? []).flatMap((item) => {
      const imdbId = item.imdbId?.trim();
      if (!imdbId) return [];
      return [
        {
          imdbId,
          title: item.title?.trim() ?? "",
          buyPriceUsd: typeof item.price === "number" ? item.price : null,
          currency: item.currency?.trim() ?? "USD",
        },
      ];
    });
  } catch {
    return [];
  }
}

export async function fetchPricesForImdbIds(imdbIds: string[]): Promise<Map<string, CheapChartsPrice>> {
  const unique = [...new Set(imdbIds.filter(Boolean))];
  const results = new Map<string, CheapChartsPrice>();

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const prices = await fetchPriceBatch(batch);
    for (const price of prices) {
      results.set(price.imdbId, price);
    }
    // Brief pause between batches to be polite to the API.
    if (i + BATCH_SIZE < unique.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}
