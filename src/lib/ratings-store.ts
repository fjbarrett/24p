import { apiFetch } from "@/lib/api-client";

export async function saveRatings(
  userEmail: string,
  ratings: Array<{ tmdbId: number; rating: number; source: string }>,
) {
  void userEmail;
  if (!ratings.length) return;
  await apiFetch<{ updated: number }>("/ratings", {
    method: "POST",
    body: JSON.stringify({
      ratings,
    }),
  });
}

export async function getRating(userEmail: string, tmdbId: number) {
  void userEmail;
  const result = await apiFetch<{ rating: number | null }>(`/ratings/${tmdbId}`);
  return typeof result.rating === "number" ? result.rating : null;
}

export async function getRatingsForUser(userEmail: string) {
  void userEmail;
  const result = await apiFetch<{
    ratings: Array<{ tmdbId: number; rating: number; source: string; updatedAt: string }>;
  }>(`/ratings`);
  const map: Record<number, number> = {};
  result.ratings.forEach((entry) => {
    map[entry.tmdbId] = entry.rating;
  });
  return map;
}
