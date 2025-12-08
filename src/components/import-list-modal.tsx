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
      <button
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-base font-semibold text-black shadow-lg shadow-black-800/30 transition hover:brightness-95"
      >
        Import list
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-black p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Import list</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-black-600 px-3 py-1 text-xs text-black-200 transition hover:border-white/60"
              >
                Close
              </button>
            </div>
            <div className="mt-4">
              <ImportListForm userEmail={userEmail} onComplete={() => setIsOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
