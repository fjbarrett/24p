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
        setMessage("Visibility updated.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update visibility.");
      }
    });
  };

  return (
    <section className="space-y-4 rounded-[28px] border border-white/8 bg-white/[0.03] p-4 sm:p-5">
      <div className="space-y-1">
        <span className="text-[11px] uppercase tracking-[0.28em] text-black-500">Visibility</span>
        <p className="text-sm text-black-400">
          {canUpdate
            ? isPublic
              ? `Public — ${baseUrl}/${username}`
              : "Private — only you can see your profile."
            : "Set a username before making your profile public."}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => updateVisibility(false)}
          disabled={!canUpdate || isPending}
          className={`rounded-2xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
            !isPublic
              ? "border-white/20 bg-white/14 text-white"
              : "border-white/10 bg-white/6 text-black-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          Private
        </button>
        <button
          type="button"
          onClick={() => updateVisibility(true)}
          disabled={!canUpdate || isPending}
          className={`rounded-2xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
            isPublic
              ? "border-white/20 bg-white/14 text-white"
              : "border-white/10 bg-white/6 text-black-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          Public
        </button>
      </div>

      {message && (
        <p className="rounded-2xl border border-white/8 bg-black/30 px-4 py-3 text-xs text-black-300">
          {message}
        </p>
      )}
    </section>
  );
}
