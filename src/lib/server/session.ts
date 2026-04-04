import "server-only";

import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getSessionUserEmail() {
  const session = (await getServerSession(authOptions)) as Session | null;
  return session?.user?.email?.trim().toLowerCase() ?? null;
}
