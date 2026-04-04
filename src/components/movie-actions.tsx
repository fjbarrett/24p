"use client";

import { useState } from "react";
import { AddToListButton } from "@/components/add-to-list-loader";
import { AppleTvLink } from "@/components/apple-tv-link";

type MovieActionsProps = {
  tmdbId: number;
  userEmail: string;
  imdbId?: string | null;
  title: string;
};

export function MovieActions({ tmdbId, userEmail, imdbId, title }: MovieActionsProps) {
  const [listExpanded, setListExpanded] = useState(false);

  return (
    <div className="mt-9">
      <AddToListButton
        tmdbId={tmdbId}
        userEmail={userEmail}
        onExpandChange={setListExpanded}
        appleTvSlot={
          imdbId ? (
            <div
              style={{
                opacity: listExpanded ? 0 : 1,
                transform: listExpanded ? 'scale(0.9)' : 'scale(1)',
                pointerEvents: listExpanded ? 'none' : 'auto',
                overflow: 'hidden',
                maxWidth: listExpanded ? '0px' : '100px',
                marginLeft: listExpanded ? '0px' : '16px',
                transition: listExpanded
                  ? 'opacity 150ms ease-in, transform 150ms ease-in, max-width 300ms cubic-bezier(0.4,0,0.2,1), margin-left 300ms cubic-bezier(0.4,0,0.2,1)'
                  : 'opacity 200ms ease-out 220ms, transform 200ms ease-out 220ms, max-width 300ms cubic-bezier(0.4,0,0.2,1), margin-left 300ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <AppleTvLink imdbId={imdbId} title={title} />
            </div>
          ) : null
        }
      />
    </div>
  );
}
