import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { UsernameCard } from "@/components/username-card";
import { authOptions } from "@/lib/auth";
import { getProfile } from "@/lib/profile-store";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = (await getServerSession(authOptions)) as Session | null;
  const userEmail = session?.user?.email?.toLowerCase() ?? "";

  if (!userEmail) {
    redirect("/");
  }

  const profile = await getProfile(userEmail);

  return (
    <div className="min-h-screen px-4 py-8 text-black-100 sm:px-8 lg:px-16">
      <div className="mx-auto w-full max-w-[720px] space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Profile</h1>
          <Link
            href="/"
            className="rounded-full border border-black-700 px-4 py-2 text-xs uppercase tracking-[0.3em] text-black-200 transition hover:border-white/60"
          >
            Back
          </Link>
        </header>
        <UsernameCard userEmail={userEmail} profile={profile} />
      </div>
    </div>
  );
}
