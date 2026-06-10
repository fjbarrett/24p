import { ImportListModal } from "@/components/import-list-modal";
import { AppleTvCodeCard } from "@/components/apple-tv-code-card";
import { SettingsShell } from "@/components/settings-shell";
import { requireSessionEmail } from "@/lib/server/session";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const userEmail = await requireSessionEmail();

  return (
    <SettingsShell title="Settings" subtitle={userEmail}>
      <ImportListModal />
      <AppleTvCodeCard />
    </SettingsShell>
  );
}
