export type ChangelogEntry = {
  slug: string;
  date: string;
  title: string;
  summary: string;
  type: "Release" | "Improvement" | "Retired";
  tags: string[];
  added?: string[];
  changed?: string[];
  removed?: string[];
};

export const changelogEntries: ChangelogEntry[] = [
  {
    slug: "stability-and-polish",
    date: "2026-04-11",
    title: "Faster detail pages and steadier ratings",
    summary:
      "Movie and TV pages were hardened so they behave more reliably when data sources are slow, and saved ratings now reflect their real last-updated time.",
    type: "Improvement",
    tags: ["movie detail", "tv detail", "ratings"],
    changed: [
      "Ratings now return their persisted update timestamp instead of a fresh timestamp on every fetch.",
      "Movie and TV detail pages were tightened up so metadata rendering is safer and less brittle.",
      "Background fetches for TMDB and ratings-related data now fail faster instead of hanging for too long.",
    ],
  },
  {
    slug: "streaming-cleanup",
    date: "2026-04-10",
    title: "Streaming got easier to trust",
    summary:
      "The streaming experience was cleaned up so filters stick, links are more accurate, and provider rows are less noisy.",
    type: "Improvement",
    tags: ["streaming", "providers", "watch links"],
    added: [
      "Your selected streaming providers and sorting choices now persist between visits.",
    ],
    changed: [
      "TV titles now open provider-specific watch destinations instead of generic fallback pages more often.",
      "Pluto TV and Tubi links were corrected, and Plex is now limited to genuinely watchable/free offers.",
    ],
    removed: [
      "Generic JustWatch fallback links were removed from title detail provider rows when a direct provider destination is available.",
    ],
  },
  {
    slug: "search-and-navigation",
    date: "2026-04-10",
    title: "Search and navigation feel calmer",
    summary:
      "Search and page-to-page movement were polished to reduce friction when you are bouncing between lists, titles, and profile pages.",
    type: "Improvement",
    tags: ["search", "navigation", "header"],
    added: [
      "A global sticky header now keeps search, back navigation, and brand access visible across most of the app.",
    ],
    changed: [
      "Search results dismiss more cleanly on route changes so stale panels do not linger.",
      "Scroll restoration behavior was refined so moving through pages feels less jumpy.",
    ],
  },
  {
    slug: "recommendations",
    date: "2026-04-09",
    title: "Recommendations started taking shape",
    summary:
      "The app now gives you more ways to discover what to watch next based on the lists you are already building.",
    type: "Release",
    tags: ["recommendations", "lists", "discovery"],
    added: [
      "A recommendations page now generates film suggestions from your saved lists.",
      "Individual lists can surface suggestion panels with one-tap add actions.",
    ],
    changed: [
      "Public list and detail flows were adjusted to make recommendation-driven browsing fit more naturally into the app.",
    ],
  },
];
