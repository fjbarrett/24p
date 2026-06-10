import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs uppercase tracking-[0.4em] text-black-400">404</p>
      <h1 className="text-3xl font-semibold text-white">Not found</h1>
      <p className="max-w-md text-sm text-black-300">
        That page, list, or title doesn&apos;t exist — or it&apos;s private.
      </p>
      <Link
        href="/"
        className="rounded-full bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-black transition hover:brightness-95 active:brightness-90"
      >
        Back home
      </Link>
    </div>
  );
}
