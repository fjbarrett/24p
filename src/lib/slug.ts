/**
 * URL slug utilities for movies, TV shows, and artists.
 *
 * Movie/TV slug format:  title-year         e.g. heat-1995, the-wire-2002
 * Artist slug format:    full-name           e.g. david-lynch, agnès-varda → agnes-varda
 *
 * Tiebreaker (same title + year): append director surname → heat-1995-mann
 * Artist tiebreaker (same name):  append birth year → john-ford-1894
 */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents: é → e, ö → o
    .replace(/[^a-z0-9]+/g, "-")     // non-alphanumeric → hyphen
    .replace(/(^-|-$)/g, "");         // trim leading/trailing hyphens
}

export function toMovieSlug(title: string, year?: number | null, directorSurname?: string | null): string {
  const base = year ? `${slugify(title)}-${year}` : slugify(title);
  return directorSurname ? `${base}-${slugify(directorSurname)}` : base;
}

export function toArtistSlug(name: string, birthYear?: number | null): string {
  const base = slugify(name);
  return birthYear ? `${base}-${birthYear}` : base;
}

/** Returns the TMDB ID if this is a legacy numeric-only slug, null otherwise. */
export function parseLegacyNumericSlug(slug: string): number | null {
  if (!/^\d+$/.test(slug)) return null;
  const id = Number(slug);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Parses a movie/TV slug back to title + year.
 * Finds the rightmost year-like segment (1888–2099) and splits there.
 * e.g. "2001-a-space-odyssey-1968" → { title: "2001 a space odyssey", year: 1968 }
 * e.g. "heat-1995-mann"            → { title: "heat", year: 1995 }
 */
export function parseMediaSlug(slug: string): { title: string; year: number | null } {
  const yearMatch = slug.match(/-(1[89]\d{2}|20[0-9]{2})(-[a-z0-9-]+)?$/);
  if (!yearMatch) return { title: slug.replace(/-/g, " "), year: null };
  const year = Number(yearMatch[1]);
  const titleSlug = slug.slice(0, slug.length - yearMatch[0].length);
  return { title: titleSlug.replace(/-/g, " "), year };
}
