"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUsername, type UserProfile } from "@/lib/profile-store";

type UsernameCardProps = {
  userEmail: string;
  profile: UserProfile | null;
};

function normalizeUsernameInput(value: string) {
  return value.trim().toLowerCase();
}

function isValidUsername(value: string) {
  return value.length >= 3 && /^[a-z0-9]+$/.test(value);
}

export function UsernameCard({ userEmail, profile }: UsernameCardProps) {
  const [username, setUsernameValue] = useState(profile?.username ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const baseUrl = typeof window === "undefined" ? "" : window.location.origin;
  const isPublic = profile?.isPublic ?? false;
  const normalized = normalizeUsernameInput(username);
  const isValid = isValidUsername(normalized);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || isPending) return;
    startTransition(async () => {
      try {
        setMessage(null);
        const updated = await setUsername(userEmail, normalized);
        setUsernameValue(updated.username);
        setMessage("Username saved");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save username");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[28px] border border-white/8 bg-white/[0.03] p-4 sm:p-5">
      <div className="space-y-1">
        <span className="text-[11px] uppercase tracking-[0.28em] text-black-500">Profile URL</span>
        <p className="text-sm text-black-300">
          {profile?.username ? (
            isPublic ? (
              `${baseUrl}/${profile.username}`
            ) : (
              "Profile is private — make it public to share a URL."
            )
          ) : (
            "Claim a username to unlock shareable URLs."
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-[0.28em] text-black-500" htmlFor="username-input">
            Username
          </label>
          <input
            id="username-input"
            value={username}
            onChange={(event) => setUsernameValue(event.target.value)}
            className="w-full rounded-2xl border border-white/8 bg-black/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-black-500 focus:border-white/18 focus:bg-black/55"
            placeholder="yourname"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={!isValid || isPending}
            className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:brightness-95 active:brightness-90 disabled:opacity-50 sm:w-auto"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-black-500">3+ characters, letters and numbers only.</p>

      {message && (
        <p className="rounded-2xl border border-white/8 bg-black/30 px-4 py-3 text-xs text-black-300">
          {message}
        </p>
      )}
    </form>
  );
}
