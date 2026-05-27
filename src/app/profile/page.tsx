import { UsernameCard } from "@/components/username-card";
import { ProfileVisibilityCard } from "@/components/profile-visibility-card";
import { SettingsShell } from "@/components/settings-shell";
import { requireSessionEmail } from "@/lib/server/session";
import { getProfileForUser } from "@/lib/server/profiles";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const userEmail = await requireSessionEmail();
  const profile = await getProfileForUser(userEmail);

  return (
    <SettingsShell title="Profile" subtitle={userEmail}>
      <UsernameCard userEmail={userEmail} profile={profile} />
      <ProfileVisibilityCard userEmail={userEmail} profile={profile} />
    </SettingsShell>
  );
}
