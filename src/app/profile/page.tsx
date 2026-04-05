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
    <div className="flex min-h-screen items-center justify-center px-4 py-8 text-black-100">
      <div className="w-full max-w-[560px] space-y-3 rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,26,26,0.98),rgba(13,13,13,1))] p-3 shadow-[0_36px_120px_rgba(0,0,0,0.72)] ring-1 ring-white/5 sm:p-5">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Profile</h1>
            <p className="text-sm text-black-400">{userEmail}</p>
          </div>
          <Link
            href="/"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/6 text-black-200 transition hover:bg-white/12 hover:text-white active:bg-white/16"
            aria-label="Back to home"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </Link>
        </div>
        <UsernameCard userEmail={userEmail} profile={profile} />
        <ProfileVisibilityCard userEmail={userEmail} profile={profile} />
      </div>
    </div>
  );
}
