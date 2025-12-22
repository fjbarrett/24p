import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { ImportListModal } from "@/components/import-list-modal";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = (await getServerSession(authOptions)) as Session | null;
  const userEmail = session?.user?.email?.toLowerCase() ?? "";

  if (!userEmail) {
    redirect("/");
  }

  return (
    <div className="min-h-screen px-4 py-8 text-black-100 sm:px-8 lg:px-16">
      <div className="mx-auto w-full max-w-[720px] space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
          <Link
            href="/"
            className="rounded-full border border-black-700 px-4 py-2 text-xs uppercase tracking-[0.3em] text-black-200 transition hover:border-white/60"
          >
            Back
          </Link>
        </header>
        <div className="space-y-3 rounded-3xl border border-white/10 bg-black-900/40 p-4">
          <p className="text-xs uppercase tracking-[0.4em] text-black-400">Import List</p>
          <p className="text-sm text-black-400">
            Bring in a CSV export to seed a new list.
          </p>
          <ImportListModal />
        </div>
      </div>
    </div>
  );
}
