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
    slug: "list-card-redesign",
    date: "2026-06-09",
    title: "Your lists now show their posters at a glance",
    summary:
      "List cards were redesigned to show a strip of film posters from each list, so you can recognize a list by its contents instead of just its color — and it now looks right on mobile, not only when hovering on a desktop.",
    type: "Improvement",
    tags: ["lists", "home", "profiles"],
    changed: [
      "Logged-in and public list cards now show a preview strip of the list's posters at rest, on every device.",
      "Posters are prepared ahead of time so cards render faster, and the old hover-only backdrop animation was removed.",
    ],
  },
  {
    slug: "faster-streaming-and-lists",
    date: "2026-06-09",
    title: "Streaming and list pages load faster",
    summary:
      "The streaming catalog and list detail pages were sped up — streaming results are cached instead of refetched on every visit, and a list's films now load in a couple of batched requests instead of one per title.",
    type: "Improvement",
    tags: ["streaming", "lists", "performance"],
    changed: [
      "Streaming catalog responses are cached, so the streaming page no longer re-queries providers on every load.",
      "Opening a list fetches its films in batches instead of one request per film, so large lists fill in much faster.",
    ],
  },
  {
    slug: "apple-tv-sign-in",
    date: "2026-06-06",
    title: "Sign in to 24p on Apple TV",
    summary:
      "There's now a 24p app for Apple TV. Generate a one-time code in Settings, enter it on your Apple TV, and your account comes with you — browse and search on the big screen.",
    type: "Release",
    tags: ["apple tv", "settings"],
    added: [
      "A new \"Apple TV\" card in Settings generates a one-time code to sign in on the 24p Apple TV app.",
      "Revoke all Apple TV codes from the same card if you lose access to a device.",
    ],
  },
  {
    slug: "known-for-clickable",
    date: "2026-06-04",
    title: "Jump straight to an artist's best-known titles",
    summary:
      "The \"known for\" titles highlighted at the top of an artist's page are now tappable — go straight to a title instead of scrolling to find it in the filmography.",
    type: "Improvement",
    tags: ["artists"],
    changed: [
      "The highlighted \"known for\" titles on an artist's page now link directly to that movie or show.",
    ],
  },
  {
    slug: "create-list-from-detail",
    date: "2026-05-30",
    title: "Start a new list right from a title",
    summary:
      "The add-to-list button on movie and TV pages now lets you spin up a brand-new list on the spot — name it and the title you're viewing is added straight away.",
    type: "Improvement",
    tags: ["movie detail", "tv detail", "lists"],
    added: [
      "Pick \"+ New list\" from the add-to-list button on any movie or TV page to create a list and drop the current title into it in one step.",
      "If you don't have any lists yet, the button opens straight to naming your first one.",
    ],
  },
  {
    slug: "movie-cast-links",
    date: "2026-04-22",
    title: "See who's in a film at a glance",
    summary:
      "Movie detail pages now show the top-billed cast just above the description — tap any name to go straight to their filmography.",
    type: "Improvement",
    tags: ["movie detail", "artists"],
    added: [
      "Top-billed cast (up to 5 names) now appears on every movie detail page, each linking to that artist's filmography.",
    ],
  },
  {
    slug: "streaming-notifications",
    date: "2026-04-16",
    title: "Get notified when your watchlist hits a new platform",
    summary:
      "Turn on streaming notifications in Settings and we'll email you a daily digest whenever a title in your lists becomes available on a new streaming service.",
    type: "Improvement",
    tags: ["notifications", "streaming"],
    added: [
      "New streaming notifications toggle in Settings — opt in to receive email digests when watchlisted titles land on new platforms.",
      "Daily digest email groups all new streaming arrivals into a single message so you're not flooded.",
    ],
  },
  {
    slug: "smarter-search",
    date: "2026-04-15",
    title: "Search ranks by what you actually want",
    summary:
      "Search results now surface the most well-known match first — typing a director's name brings up the director before a list of films that share a word.",
    type: "Improvement",
    tags: ["search", "artists"],
    changed: [
      "Search ranking now weights popularity heavily so famous directors, actors, and titles reach the top instead of being buried by obscure exact matches.",
      "Artist pages were redesigned to match the rest of the app — darker background, cleaner typography, and notable works shown right in the header.",
      "Filmography pages collapse duplicate credits (e.g. Director + Writer on the same film) into a single entry showing the most significant role.",
      "Self-appearances and documentary cameos are now grouped separately and hidden by default.",
    ],
  },
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
