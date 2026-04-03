"use client";

import { useState, useTransition } from "react";
import { setProfileVisibility, type UserProfile } from "@/lib/profile-store";

type ProfileVisibilityCardProps = {
  userEmail: string;
  profile: UserProfile | null;
};

export function ProfileVisibilityCard({ userEmail, profile }: ProfileVisibilityCardProps) {
  const [isPublic, setIsPublic] = useState(profile?.isPublic ?? false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const baseUrl = typeof window === "undefined" ? "" : window.location.origin;
  const username = profile?.username;
  const canUpdate = Boolean(username);

  const updateVisibility = (nextValue: boolean) => {
    if (!canUpdate || isPending || nextValue === isPublic) return;
    startTransition(async () => {
      try {
        setMessage(null);
        const updated = await setProfileVisibility(userEmail, nextValue);
        setIsPublic(updated.isPublic);
        setMessage("Profile visibility updated.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update profile visibility.");
      }
    });
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-black-900/40 p-4 text-black-100">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-black-400">Profile visibility</p>
          <p className="text-sm text-black-400">
            {canUpdate
              ? "Choose whether your profile is visible at your username URL."
              : "Set a username before making your profile public."}
          </p>
          {canUpdate && isPublic && (
            <p className="text-sm text-black-200">
              {baseUrl ? `${baseUrl}/${username}` : `/${username}`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => updateVisibility(false)}
            disabled={!canUpdate || isPending}
            className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.3em] ${
              !isPublic
                ? "border-white/60 text-white"
                : "border-white/20 text-white/60 hover:bg-white/8 hover:border-white/35 hover:text-white"
            } disabled:opacity-50`}
          >
            Private
          </button>
          <button
            type="button"
            onClick={() => updateVisibility(true)}
            disabled={!canUpdate || isPending}
            className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.3em] ${
              isPublic
                ? "border-white/60 text-white"
                : "border-white/20 text-white/60 hover:bg-white/8 hover:border-white/35 hover:text-white"
            } disabled:opacity-50`}
          >
            Public
          </button>
        </div>
      </div>
      {message && <p className="mt-3 text-xs text-black-400">{message}</p>}
    </section>
  );
}
