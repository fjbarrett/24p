import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveTvToken } from "@/lib/server/tv-tokens";

export type SessionUser = {
  id: string | null;
  email: string;
  name: string | null;
  image: string | null;
};

// Memoized per request so the layout, pages, and route handlers that each need
// the session don't repeat getServerSession / the bearer-token DB lookup.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = (await getServerSession(authOptions)) as Session | null;
  const user = session?.user;
  const email = user?.email?.trim().toLowerCase() ?? null;
  if (email) {
    return {
      id: user?.id ?? null,
      email,
      name: user?.name?.trim() ?? null,
      image: user?.image?.trim() ?? null,
    };
  }

  // Native clients (Apple TV) authenticate with a long-lived bearer token
  // instead of the browser session cookie.
  const bearerEmail = await resolveBearerEmail();
  if (bearerEmail) {
    return { id: null, email: bearerEmail, name: null, image: null };
  }

  return null;
});

async function resolveBearerEmail(): Promise<string | null> {
  const authHeader = (await headers()).get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  return resolveTvToken(token);
}

export async function getSessionUserEmail() {
  return (await getSessionUser())?.email ?? null;
}

export async function requireSessionEmail(): Promise<string> {
  const email = await getSessionUserEmail();
  if (!email) redirect("/");
  return email;
}
