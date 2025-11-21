import type { CuratedList } from "@/lib/app-data";
import Link from "next/link";

type ShareCardProps = {
  list: CuratedList;
};

export function ShareCard({ list }: ShareCardProps) {
  const shareUrl = `https://24p.app/${list.slug}`;
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/30 to-neutral-900/30 p-6">
      <p className="text-xs uppercase tracking-[0.4em] text-slate-300">Share</p>
      <h3 className="mt-3 text-2xl font-semibold text-white">{list.name}</h3>
      <p className="mt-1 text-sm text-slate-400">{list.description}</p>
      <dl className="mt-4 flex gap-4 text-sm text-slate-300">
        <div>
          <dt className="text-xs text-slate-500">Followers</dt>
          <dd className="text-lg font-semibold text-slate-50">{list.followers}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Visibility</dt>
          <dd className="capitalize">{list.visibility}</dd>
        </div>
      </dl>
      <div className="mt-6 rounded-2xl bg-slate-950/60 p-3 text-sm">
        <p className="text-slate-500">Public link</p>
        <Link
          href={shareUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block truncate text-slate-200 hover:text-white"
        >
          {shareUrl}
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
        <span className="rounded-full border border-slate-700 px-3 py-1">OG image ready</span>
        <span className="rounded-full border border-slate-700 px-3 py-1">Embeddable</span>
        <span className="rounded-full border border-slate-700 px-3 py-1">Invite co-curators</span>
      </div>
    </div>
  );
}
