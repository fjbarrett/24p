import "server-only";

const JUSTWATCH_GRAPHQL = "https://apis.justwatch.com/graphql";

type JwOffer = {
  standardWebURL: string;
  package: { packageId: number };
};

type JwMovie = {
  id: string;
  content: { title: string; originalReleaseYear: number | null };
  offers: JwOffer[] | null;
};

type JwSearchResult = {
  data: {
    searchTitles: {
      edges: { node: JwMovie }[];
    };
  };
};

const SEARCH_QUERY = `
  query($q:String!,$country:Country!,$lang:Language!){
    searchTitles(
      source:"JUSTWATCH_CATALOG"
      country:$country
      language:$lang
      first:5
      filter:{objectTypes:[MOVIE],searchQuery:$q}
    ){
      edges{
        node{
          id
          ... on Movie{
            content(country:$country,language:$lang){ title originalReleaseYear }
            offers(country:$country,platform:WEB){ standardWebURL package{ packageId } }
          }
        }
      }
    }
  }
`;

function bestMatch(nodes: JwMovie[], title: string, year?: number): JwMovie | null {
  const normalizedTitle = title.trim().toLowerCase();
  const scored = nodes.map((node) => {
    const t = node.content.title.trim().toLowerCase();
    let score = 0;
    if (t === normalizedTitle) score += 100;
    else if (t.startsWith(normalizedTitle)) score += 50;
    if (year && node.content.originalReleaseYear === year) score += 40;
    return { node, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].node : (nodes[0] ?? null);
}

export async function fetchJustWatchLinks(
  title: string,
  year?: number,
  locale = "US",
): Promise<Record<number, string>> {
  try {
    const response = await fetch(JUSTWATCH_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({
        query: SEARCH_QUERY,
        variables: { q: title, country: locale, lang: "en" },
      }),
      next: { revalidate: 60 * 60 * 6 },
    });

    if (!response.ok) return {};

    const data = (await response.json()) as JwSearchResult;
    const nodes = data.data.searchTitles.edges.map((e) => e.node);
    if (!nodes.length) return {};

    const match = bestMatch(nodes, title, year);
    if (!match?.offers?.length) return {};

    // De-duplicate: keep first URL per packageId
    const map: Record<number, string> = {};
    for (const offer of match.offers) {
      const id = offer.package.packageId;
      if (!map[id]) map[id] = offer.standardWebURL;
    }
    return map;
  } catch {
    return {};
  }
}
