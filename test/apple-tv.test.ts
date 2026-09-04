import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { PublicHttpError, routeError } from "@/lib/server/http";

// Contract pins for GET /api/apple-tv, consumed by web
// (streaming-provider-row) and both native clients (AppleTvLink):
// - 200 with {url, price} where each may be null (unknown id, upstream
//   miss, or rejected non-Apple URL), always Cache-Control: no-store.
// - non-2xx is always {error} (429 carries Retry-After), never the nullable
//   link shape, so decoders must branch on status before decoding the body.

// Hermetic: the repo .env points at a live proxy AND a live database.
// Neutralize both so these tests never touch the network beyond the
// per-test fetch stub. getPool() caches in globalThis.__24pPool, so a pool
// created by an earlier test file must be cleared too — every DB-backed
// helper in the lookup path (rate limiter, cache) fails open to null.
const savedDbUrl = process.env.DATABASE_URL;
const savedPool = globalThis.__24pPool;
const savedStrawberry = process.env.STRAWBERRY_BASE_URL;
const savedPublicStrawberry = process.env.NEXT_PUBLIC_STRAWBERRY_BASE_URL;
delete process.env.DATABASE_URL;
delete process.env.STRAWBERRY_BASE_URL;
delete process.env.NEXT_PUBLIC_STRAWBERRY_BASE_URL;
globalThis.__24pPool = undefined;
afterAll(() => {
  if (savedDbUrl !== undefined) process.env.DATABASE_URL = savedDbUrl;
  if (savedStrawberry !== undefined) process.env.STRAWBERRY_BASE_URL = savedStrawberry;
  if (savedPublicStrawberry !== undefined) {
    process.env.NEXT_PUBLIC_STRAWBERRY_BASE_URL = savedPublicStrawberry;
  }
  globalThis.__24pPool = savedPool;
});

const { GET } = await import("@/app/api/apple-tv/route");

const realFetch = globalThis.fetch;
let lastUrl = "";
function stubFetch(payload: unknown) {
  lastUrl = "";
  globalThis.fetch = (async (input: unknown) => {
    lastUrl = String(input);
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as typeof fetch;
}
afterEach(() => {
  globalThis.fetch = realFetch;
});

function request(imdbId: string | null, title: string) {
  const params = new URLSearchParams({ title });
  if (imdbId !== null) params.set("imdbId", imdbId);
  return new Request(`http://localhost/api/apple-tv?${params.toString()}`);
}

describe("apple-tv contract", () => {
  test("invalid imdbId returns the null link envelope without touching upstreams", async () => {
    let called = false;
    globalThis.fetch = (() => {
      called = true;
      throw new Error("must not fetch");
    }) as unknown as typeof fetch;

    const res = await GET(request("not-an-id", "Heat"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: null, price: null });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(called).toBe(false);
  });

  test("missing imdbId returns the null link envelope", async () => {
    const res = await GET(request(null, "Heat"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: null, price: null });
  });

  test("valid id resolves the Apple URL and normalizes the price", async () => {
    stubFetch({
      results: {
        hits: [
          {
            imdbId: "tt9000001",
            productPageUrl: "https://tv.apple.com/us/movie/heat/umc.xyz",
            price: "9.99",
          },
        ],
      },
    });

    const res = await GET(request("tt9000001", "Heat"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: "https://tv.apple.com/us/movie/heat/umc.xyz",
      price: "$9.99",
    });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  test("non-Apple upstream URL is rejected and never surfaces", async () => {
    stubFetch({
      results: [{ imdbId: "tt9000002", productPageUrl: "https://evil.example/watch", price: "$4.99" }],
    });

    // The poisoned URL is dropped; with no fallback source configured the
    // whole lookup is a miss, so the orphan price goes with it. Clients must
    // treat a null url as "no offer" regardless of price.
    const res = await GET(request("tt9000002", "Heat"));
    expect(await res.json()).toEqual({ url: null, price: null });
  });

  test("overlong titles are truncated before the upstream lookup", async () => {
    stubFetch({ results: {} });

    const res = await GET(request("tt9000003", "A".repeat(300)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: null, price: null });
    const searchTerm = new URL(lastUrl).searchParams.get("searchTerm") ?? "";
    expect(searchTerm.length).toBe(200);
  });

  test("rate-limit failures keep the {error} envelope, never the link shape", async () => {
    const res = routeError(
      "api/apple-tv",
      new PublicHttpError("Too many requests", 429),
      "Unable to load Apple TV link",
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Too many requests" });
  });
});
