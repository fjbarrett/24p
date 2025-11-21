import { NextResponse } from "next/server";
import { addList } from "@/lib/list-store";
import { saveRatings } from "@/lib/ratings-store";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function searchTmdb(title: string, year?: string) {
  if (!TMDB_API_KEY) return null;
  const query = new URLSearchParams({ query: title, include_adult: "false" });
  if (year) query.set("year", year);
  const isV4Token = TMDB_API_KEY.trim().startsWith("eyJ");
  if (!isV4Token) {
    query.set("api_key", TMDB_API_KEY.trim());
  }
  const response = await fetch(`https://api.themoviedb.org/3/search/movie?${query}`, {
    headers: {
      ...(isV4Token
        ? { Authorization: `Bearer ${TMDB_API_KEY.trim()}` }
        : {}),
      Accept: "application/json",
    },
    next: { revalidate: 60 * 60 },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { results?: Array<{ id: number }> };
  return data.results?.[0]?.id ?? null;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ""));
}

type ParsedEntry = { title?: string; year?: string; rating?: number; source: string };

function parseImportedTitles(raw: string): ParsedEntry[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const firstLine = lines[0].toLowerCase();
  const defaultSource = firstLine.includes("letterboxd") ? "letterboxd" : "imdb";
  if (firstLine.includes("title") || firstLine.includes("name")) {
    const headers = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase());
    const titleIndex = headers.findIndex((cell) => cell === "title" || cell === "primarytitle" || cell === "name");
    const yearIndex = headers.findIndex((cell) => cell === "year" || cell === "release year" || cell === "startyear");
    const ratingIndex = headers.findIndex((cell) => cell === "your rating" || cell === "rating");
    if (titleIndex === -1) return [];
    return lines.slice(1).map((line) => {
      const cells = parseCsvLine(line);
      const rawRating = ratingIndex >= 0 ? Number(cells[ratingIndex]) : undefined;
      const rating = typeof rawRating === "number" && !Number.isNaN(rawRating)
        ? rawRating <= 5
          ? Math.round(rawRating * 2)
          : Math.round(rawRating)
        : undefined;
      return {
        title: cells[titleIndex]?.trim(),
        year: yearIndex >= 0 ? cells[yearIndex]?.trim() : undefined,
        rating,
        source: defaultSource,
      };
    });
  }
  // fallback: each line is a title (optionally "Title (Year)")
  return lines.map((line) => {
    const match = /(.*)\((\d{4})\)/.exec(line);
    if (match) {
      return { title: match[1].trim(), year: match[2], source: defaultSource };
    }
    return { title: line, source: defaultSource };
  });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const title = typeof payload?.title === "string" ? payload.title : "";
  const body = typeof payload?.data === "string" ? payload.data : "";
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email?.toLowerCase();
  if (!title.trim() || !body.trim()) {
    return NextResponse.json({ error: "Title and data are required" }, { status: 400 });
  }
  if (!userEmail) {
    return NextResponse.json({ error: "Sign in to import" }, { status: 401 });
  }

  const entries = parseImportedTitles(body).filter((entry) => entry.title);
  const ids: number[] = [];
  const ratingPairs: Array<{ tmdbId: number; rating: number; source: string }> = [];
  for (const entry of entries) {
    const tmdbId = await searchTmdb(entry.title, entry.year);
    if (tmdbId) {
      ids.push(tmdbId);
      if (typeof entry.rating === "number" && entry.rating > 0) {
        ratingPairs.push({ tmdbId, rating: entry.rating, source: entry.source });
      }
    }
  }

  if (!ids.length) {
    return NextResponse.json({ error: "No movies could be matched" }, { status: 400 });
  }

  const list = await addList(title, ids);
  if (ratingPairs.length) {
    await saveRatings(userEmail, ratingPairs);
  }
  return NextResponse.json({ list });
}
