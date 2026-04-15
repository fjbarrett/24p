import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import type { Metadata } from "next";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getAdminStats } from "@/lib/server/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

const ADMIN_EMAIL = "frank.e.barrett@gmail.com";

function fmt(n: string | number) {
  return Number(n).toLocaleString();
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default async function AdminPage() {
  const session = (await getServerSession(authOptions)) as Session | null;
  const email = session?.user?.email?.toLowerCase() ?? "";
  if (email !== ADMIN_EMAIL) redirect("/");

  const { overview, users, recentLists, topLists, week } = await getAdminStats();

  const summaryStats = [
    { label: "Users", value: fmt(overview.user_count) },
    { label: "Lists", value: fmt(overview.list_count) },
    { label: "Public lists", value: fmt(overview.public_list_count) },
    { label: "Films added", value: fmt(overview.item_count) },
    { label: "Ratings", value: fmt(overview.rating_count) },
    { label: "Favorites", value: fmt(overview.favorite_count) },
  ];

  const weekStats = [
    { label: "New users", value: week.signups },
    { label: "New lists", value: week.lists },
    { label: "Ratings activity", value: week.ratings },
  ];

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-white/40">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {summaryStats.map(({ label, value }) => (
          <div key={label} className="rounded-2xl bg-white/5 p-4">
            <p className="text-xs text-white/40">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* This week */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {weekStats.map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-white/6 bg-white/3 p-4">
            <p className="text-xs text-white/40">{label} <span className="text-white/25">(7d)</span></p>
            <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent lists + Top lists */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl bg-white/5 p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/35">Recent Lists</h2>
          <div className="space-y-3">
            {recentLists.map((list) => (
              <div key={`${list.username}-${list.slug}`} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {list.username ? (
                    <Link
                      href={`/${list.username}/${list.slug}`}
                      className="block truncate text-sm text-white/80 hover:text-white"
                    >
                      {list.title}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm text-white/80">{list.title}</span>
                  )}
                  <p className="mt-0.5 text-xs text-white/30">
                    {list.username ? `@${list.username}` : "—"} · {fmt(list.item_count)} films · {relativeDate(list.created_at)}
                  </p>
                </div>
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    list.visibility === "public"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "text-white/20"
                  }`}
                >
                  {list.visibility}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white/5 p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-white/35">Top Lists by Favorites</h2>
          <div className="space-y-3">
            {topLists.map((list) => (
              <div key={`${list.username}-${list.slug}`} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {list.username ? (
                    <Link
                      href={`/${list.username}/${list.slug}`}
                      className="block truncate text-sm text-white/80 hover:text-white"
                    >
                      {list.title}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm text-white/80">{list.title}</span>
                  )}
                  <p className="mt-0.5 text-xs text-white/30">
                    {list.username ? `@${list.username}` : "—"} · {fmt(list.item_count)} films
                  </p>
                </div>
                <span className="mt-0.5 shrink-0 text-sm font-medium text-amber-400/80">
                  ♥ {fmt(list.favorite_count)}
                </span>
              </div>
            ))}
            {topLists.every((l) => Number(l.favorite_count) === 0) && (
              <p className="text-sm text-white/25">No favorites yet</p>
            )}
          </div>
        </section>
      </div>

      {/* Users table */}
      <section className="mt-6 rounded-2xl bg-white/5 p-4">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-white/35">
          Users <span className="ml-1 font-normal normal-case text-white/20">({users.length})</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/6 text-left text-xs text-white/30">
                <th className="pb-2 pr-6 font-medium">Username</th>
                <th className="pb-2 pr-6 font-medium">Email</th>
                <th className="pb-2 pr-6 text-right font-medium">Lists</th>
                <th className="pb-2 pr-6 text-right font-medium">Ratings</th>
                <th className="pb-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.user_email} className="border-b border-white/4 last:border-0">
                  <td className="py-2.5 pr-6">
                    {user.username ? (
                      <Link href={`/${user.username}`} className="text-white/80 hover:text-white">
                        @{user.username}
                      </Link>
                    ) : (
                      <span className="text-white/25">—</span>
                    )}
                    {user.is_public && (
                      <span className="ml-1.5 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-400">public</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-6 text-xs text-white/35">{user.user_email}</td>
                  <td className="py-2.5 pr-6 text-right text-white/60">{fmt(user.list_count)}</td>
                  <td className="py-2.5 pr-6 text-right text-white/60">{fmt(user.rating_count)}</td>
                  <td className="py-2.5 text-xs text-white/30">{relativeDate(user.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
