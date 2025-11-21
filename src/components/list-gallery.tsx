import Link from "next/link";
import type { SavedList } from "@/lib/list-store";

export function ListGallery({ lists }: { lists: SavedList[] }) {
  if (!lists.length) {
    return (
      <section id="lists" className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Lists</p>
        <p className="mt-2 text-sm text-slate-500">No lists yet. Use the button above to create your first one.</p>
      </section>
    );
  }

  return (
    <section id="lists" className="space-y-4">
      <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Your latest lists</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {lists.map((list) => (
          <article key={list.id} className="rounded-3xl border border-white/10 bg-slate-900/40 p-5">
            <p className="text-xs text-slate-500">{new Date(list.createdAt).toLocaleDateString()}</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{list.title}</h3>
            <p className="text-sm text-slate-400">Slug: {list.slug}</p>
            <div className="mt-4 flex gap-3 text-sm">
              <Link href={`/lists/${list.slug}`} className="text-sky-300 hover:text-sky-200">
                Edit details
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
