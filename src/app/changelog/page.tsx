import type { Metadata } from "next";
import { changelogEntries } from "@/lib/changelog";
import { ChangelogClientPage } from "@/components/changelog-client-page";

export const metadata: Metadata = {
  title: "Changelog",
  description: "See what has changed in 24p, from new features to cleaner watch flows and reliability fixes.",
  alternates: {
    canonical: "/changelog",
  },
};

export default function ChangelogPage() {
  return <ChangelogClientPage entries={changelogEntries} />;
}
