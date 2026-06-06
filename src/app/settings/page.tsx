import { ImportListModal } from "@/components/import-list-modal";
import { StreamingNotificationsCard } from "@/components/streaming-notifications-card";
import { AppleTvCodeCard } from "@/components/apple-tv-code-card";
import { SettingsShell } from "@/components/settings-shell";
import { requireSessionEmail } from "@/lib/server/session";
import { getProfileForUser } from "@/lib/server/profiles";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const userEmail = await requireSessionEmail();
  const profile = await getProfileForUser(userEmail);

  return (
    <SettingsShell title="Settings" subtitle={userEmail}>
      <ImportListModal />
      <StreamingNotificationsCard userEmail={userEmail} profile={profile} />
      <AppleTvCodeCard />
    </SettingsShell>
  );
}
