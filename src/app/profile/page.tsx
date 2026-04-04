import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { UsernameCard } from "@/components/username-card";
import { ProfileVisibilityCard } from "@/components/profile-visibility-card";
import { authOptions } from "@/lib/auth";
import type { Metadata } from "next";
import { getProfileForUser } from "@/lib/server/profiles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProfilePage() {
  const session = (await getServerSession(authOptions)) as Session | null;
  const userEmail = session?.user?.email?.toLowerCase() ?? "";

  if (!userEmail) {
    redirect("/");
  }

  const profile = await getProfileForUser(userEmail);

  return (
    <div className="min-h-screen px-4 py-8 text-black-100 sm:px-8 lg:px-16">
      <div className="mx-auto w-full max-w-[720px] space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Profile</h1>
          <Link
            href="/"
            className="rounded-full bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-black transition hover:brightness-95 active:brightness-90"
          >
            Back
          </Link>
        </header>
        <UsernameCard userEmail={userEmail} profile={profile} />
        <ProfileVisibilityCard userEmail={userEmail} profile={profile} />
      </div>
    </div>
  );
}
