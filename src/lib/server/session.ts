import "server-only";

import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";

export type SessionUser = {
  id: string | null;
  email: string;
  name: string | null;
  image: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = (await getServerSession(authOptions)) as Session | null;
  const user = session?.user;
  const email = user?.email?.trim().toLowerCase() ?? null;
  if (!email) return null;

  return {
    id: user?.id ?? null,
    email,
    name: user?.name?.trim() ?? null,
    image: user?.image?.trim() ?? null,
  };
}

export async function getSessionUserEmail() {
  return (await getSessionUser())?.email ?? null;
}
