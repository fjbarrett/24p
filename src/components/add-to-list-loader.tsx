"use client";

import { useEffect, useState } from "react";
import { AddToListPopover } from "@/components/add-to-list-popover";
import { loadLists, type SavedList } from "@/lib/list-store";

type AddToListLoaderProps = {
  tmdbId: number;
  userEmail: string;
};

export function AddToListLoader({ tmdbId, userEmail }: AddToListLoaderProps) {
  const [lists, setLists] = useState<SavedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    loadLists(userEmail)
      .then((data) => {
        if (!active) return;
        setLists(data);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userEmail]);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-black-950/60 p-3">
        <p className="text-sm text-black-200">Loading your lists…</p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="rounded-2xl bg-black-950/60 p-3">
        <p className="text-sm text-black-200">Unable to load lists.</p>
      </div>
    );
  }

  return <AddToListPopover lists={lists} tmdbId={tmdbId} userEmail={userEmail} />;
}
