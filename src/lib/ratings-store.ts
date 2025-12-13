import { rustApiFetch } from "@/lib/rust-api-client";

export async function saveRatings(
  userEmail: string,
  ratings: Array<{ tmdbId: number; rating: number; source: string }>,
) {
  if (!ratings.length) return;
  await rustApiFetch<{ updated: number }>("/ratings", {
    method: "POST",
    body: JSON.stringify({
      userEmail,
      ratings,
    }),
  });
}

export async function getRating(userEmail: string, tmdbId: number) {
  const result = await rustApiFetch<{ rating: number | null }>(
    `/ratings/${encodeURIComponent(userEmail)}/${tmdbId}`,
  );
  return typeof result.rating === "number" ? result.rating : null;
}

export async function getRatingsForUser(userEmail: string) {
  const result = await rustApiFetch<{
    ratings: Array<{ tmdbId: number; rating: number; source: string; updatedAt: string }>;
  }>(`/ratings/${encodeURIComponent(userEmail)}`);
  const map: Record<number, number> = {};
  result.ratings.forEach((entry) => {
    map[entry.tmdbId] = entry.rating;
  });
  return map;
}
