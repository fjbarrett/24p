import { afterEach, describe, expect, mock, test } from "bun:test";

// bun module mocks are process-global: this replaces @/lib/server/tmdb for every
// file in the run, including modules that import other functions from it. An
// export missing here surfaces in an unrelated test as "Export named 'x' not
// found", so the stub covers the whole surface other server modules import.
// Only fetchTmdbArtwork is exercised; the rest throw rather than hand back
// plausible-looking data to a caller that should not be reaching TMDB at all.
function unstubbed(name: string) {
  return () => {
    throw new Error(`@/lib/server/tmdb.${name} is stubbed out for this test run`);
  };
}

mock.module("@/lib/server/tmdb", () => ({
  fetchTmdbArtwork: async () => null,
  fetchTmdbMovie: unstubbed("fetchTmdbMovie"),
  fetchTmdbMovies: unstubbed("fetchTmdbMovies"),
  fetchTmdbPersonWithFilmography: unstubbed("fetchTmdbPersonWithFilmography"),
  fetchTmdbRecommendationsForMovie: unstubbed("fetchTmdbRecommendationsForMovie"),
  fetchTmdbShow: unstubbed("fetchTmdbShow"),
  fetchTmdbTrailerForMovie: unstubbed("fetchTmdbTrailerForMovie"),
  fetchTmdbTrailerForShow: unstubbed("fetchTmdbTrailerForShow"),
  fetchWatchProviders: unstubbed("fetchWatchProviders"),
  findTmdbMovieId: unstubbed("findTmdbMovieId"),
  resolveMovieSlug: unstubbed("resolveMovieSlug"),
  resolvePersonSlug: unstubbed("resolvePersonSlug"),
  resolveTvSlug: unstubbed("resolveTvSlug"),
  searchTmdb: unstubbed("searchTmdb"),
}));

const { fetchJustWatchOffers } = await import("@/lib/server/justwatch");

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubSearchResponse(offers: Array<Record<string, unknown>>) {
  const payload = {
    data: {
      searchTitles: {
        edges: [
          {
            node: {
              id: "tm1",
              objectType: "MOVIE",
              content: { title: "Inception", originalReleaseYear: 2010 },
              offers,
            },
          },
        ],
      },
    },
  };
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

const pkg = { packageId: 8, clearName: "Netflix", technicalName: "netflix", shortName: "nfx", icon: null };

describe("fetchJustWatchOffers URL hardening", () => {
  test("drops javascript: and data: offer URLs but keeps the clean one", async () => {
    // A clean offer must survive alongside the hostile ones: asserting a bare
    // [] also passes when the fetch stub stops matching (upstream failures
    // return []), which would let this test green-light with the sanitizer
    // never executed.
    stubSearchResponse([
      { standardWebURL: "javascript:alert(1)", monetizationType: "FLATRATE", package: pkg },
      { standardWebURL: "data:text/html,<script>1</script>", monetizationType: "FLATRATE", package: pkg },
      { standardWebURL: "https://www.netflix.com/title/1", monetizationType: "FLATRATE", package: pkg },
    ]);
    const offers = await fetchJustWatchOffers("Inception", 2010, undefined, "movie");
    expect(offers).toHaveLength(1);
    expect(offers[0].url).toBe("https://www.netflix.com/title/1");
  });

  test("unwraps click.justwatch.com redirects to the direct target only when it is http(s)", async () => {
    stubSearchResponse([
      {
        standardWebURL: "https://click.justwatch.com/a?r=" + encodeURIComponent("https://www.netflix.com/title/1"),
        monetizationType: "FLATRATE",
        package: pkg,
      },
      {
        standardWebURL: "https://click.justwatch.com/a?r=" + encodeURIComponent("javascript:alert(1)"),
        monetizationType: "RENT",
        package: pkg,
      },
    ]);
    const offers = await fetchJustWatchOffers("Inception", 2010, undefined, "movie");
    expect(offers).toHaveLength(1);
    expect(offers[0].url).toBe("https://www.netflix.com/title/1");
  });

  test("keeps plain https provider URLs", async () => {
    stubSearchResponse([
      { standardWebURL: "https://tv.apple.com/movie/inception", monetizationType: "BUY", package: pkg },
    ]);
    const offers = await fetchJustWatchOffers("Inception", 2010, undefined, "movie");
    expect(offers).toHaveLength(1);
    expect(offers[0].url).toBe("https://tv.apple.com/movie/inception");
  });
});
