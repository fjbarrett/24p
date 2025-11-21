import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveRatings } from "@/lib/ratings-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email?.toLowerCase();
  if (!userEmail) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const tmdbId = Number(payload?.tmdbId);
  const rating = Number(payload?.rating);

  if (!Number.isFinite(tmdbId) || rating < 1 || rating > 10) {
    return NextResponse.json({ error: "Invalid rating payload" }, { status: 400 });
  }

  await saveRatings(userEmail, [
    {
      tmdbId,
      rating,
      source: "manual",
    },
  ]);

  return NextResponse.json({ ok: true, rating });
}
