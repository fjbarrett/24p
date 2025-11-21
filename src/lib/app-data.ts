export type CuratedList = {
  slug: string;
  name: string;
  description: string;
  author: string;
  followers: number;
  visibility: "private" | "public";
  tmdbIds: number[];
};

export const curatedLists: CuratedList[] = [
  {
    slug: "year-of-sci-fi",
    name: "Weird Futures",
    description: "Solar-punk meditations for late-night rewatches.",
    author: "Frank B.",
    followers: 218,
    visibility: "public",
    tmdbIds: [329865, 324857, 666277], // Arrival, Spider-Verse, Past Lives
  },
  {
    slug: "sunday-feels",
    name: "Sunday Feels",
    description: "Films that deserve a pour-over and quiet afternoon.",
    author: "Mara J.",
    followers: 502,
    visibility: "public",
    tmdbIds: [666277, 244786, 120], // Past Lives, Whiplash, Fellowship
  },
  {
    slug: "rewatchables",
    name: "Rewatchables",
    description: "Party-ready hits to show friends who trust your taste.",
    author: "24p",
    followers: 98,
    visibility: "private",
    tmdbIds: [324857, 120], // Spider-Verse, Fellowship
  },
];

export const suggestedTmdbIds = [329865, 666277, 244786, 324857, 120, 466420];

export const featureHighlights = [
  {
    title: "Google sign-in",
    body: "OAuth keeps onboarding to one tap. We store zero passwords.",
    badge: "Auth",
  },
  {
    title: "Ratings that travel",
    body: "Drop 1–10 scores, attach notes later, and surface them on every list.",
    badge: "Ratings",
  },
  {
    title: "List collaboration",
    body: "Invite co-curators, lock sequencing, and keep drafts private until ready.",
    badge: "Lists",
  },
  {
    title: "Shareable profiles",
    body: "Every public list receives a clean link card plus OpenGraph art.",
    badge: "Sharing",
  },
];

export const productStats = [
  { label: "Movies logged", value: "4,820" },
  { label: "Lists shared", value: "327" },
  { label: "Friends collaborating", value: "1,204" },
];
