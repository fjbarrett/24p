import Link from "next/link";
import type { SavedList } from "@/lib/list-store";
import { getListColorStyles } from "@/lib/list-colors";

type ListGalleryProps = {
  lists: SavedList[];
};

export function ListGallery({ lists }: ListGalleryProps) {
  if (!lists.length) {
    return (
      <section id="lists" className="rounded-3xl border border-white/10 bg-black-900/40 p-6 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-black-400">Lists</p>
        <p className="mt-2 text-sm text-black-500">No lists yet. Use the button above to create your first one.</p>
      </section>
    );
  }

  return (
    <section id="lists" className="space-y-4">
      {/* <p className="text-xs uppercase tracking-[0.4em] text-black-400">Your latest lists</p> */}
      <div className="grid gap-4 sm:grid-cols-2">
        {lists.map((list) => (
          <Link
            key={list.id}
            href={`/lists/${list.slug}`}
            className="group relative block h-52 overflow-hidden rounded-3xl border border-white/10 bg-black transition hover:border-black-400"
          >
            <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/10 bg-gradient-to-br from-black-900 via-black-950 to-black-900" />
            <div
              className="pointer-events-none absolute inset-[3px] rounded-3xl opacity-70"
              style={getListColorStyles(list.color).overlay}
            />
            <div className="pointer-events-none absolute inset-[6px] rounded-3xl border border-white/5" />
            <div className="relative z-10 flex h-full flex-col justify-end space-y-1 p-5">
              <h3 className="text-xl font-semibold text-white group-hover:text-black-200">{list.title}</h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
