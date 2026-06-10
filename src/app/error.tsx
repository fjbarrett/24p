"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs uppercase tracking-[0.4em] text-black-400">Error</p>
      <h1 className="text-3xl font-semibold text-white">Something went wrong</h1>
      <p className="max-w-md text-sm text-black-300">
        An unexpected error occurred. This has been logged — please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-black transition hover:brightness-95 active:brightness-90"
      >
        Try again
      </button>
    </div>
  );
}
