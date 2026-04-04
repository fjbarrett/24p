"use client";

import { CreateListButton } from "@/components/create-list-button";
import { ListGallery } from "@/components/list-gallery";
import type { SavedList } from "@/lib/list-store";

type ListsSectionProps = {
  lists: SavedList[];
  userEmail: string;
};

export function ListsSection({ lists, userEmail }: ListsSectionProps) {
  return (
    <div className="space-y-4 rounded-3xl bg-black-900/30 p-4 backdrop-blur sm:space-y-6 sm:p-6" id="lists">
      <CreateListButton userEmail={userEmail} />
      <ListGallery
        lists={lists}
        emptyMessage="No lists yet. Use the buttons below to create or import your first one."
      />
    </div>
  );
}
