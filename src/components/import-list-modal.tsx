"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { ImportListForm } from "@/components/import-list-form";

export function ImportListModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = useSession();
  const userEmail = session?.user?.email?.toLowerCase() ?? null;

  return (
    <>
      <section className="space-y-4 rounded-[28px] border border-white/8 bg-white/[0.03] p-4 sm:p-5">
        <div className="space-y-1">
          <span className="text-[11px] uppercase tracking-[0.28em] text-black-500">Import list</span>
          <p className="text-sm text-black-400">Bring in a Letterboxd or IMDb CSV export to seed a new list.</p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:brightness-95 active:brightness-90"
        >
          Import list
        </button>
      </section>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-3 py-3 sm:px-4 sm:py-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-list-title"
        >
          <div className="relative max-h-[calc(100dvh-24px)] w-full max-w-[640px] overflow-y-auto rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,26,26,0.98),rgba(13,13,13,1))] shadow-[0_36px_120px_rgba(0,0,0,0.72)] ring-1 ring-white/5 sm:max-h-[calc(100dvh-32px)]">
            <div className="space-y-5 p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-5">
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold tracking-tight text-white" id="import-list-title">
                    Import list
                  </h2>
                  <p className="text-sm text-black-400">Match titles against TMDB and create a new list.</p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/6 text-black-200 transition hover:bg-white/12 hover:text-white active:bg-white/16"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <ImportListForm userEmail={userEmail} onComplete={() => setIsOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
