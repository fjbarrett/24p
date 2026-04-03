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
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-white/10 bg-black-900/40 p-4 text-black-100"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-black-400">Profile URL</p>
          <div className="text-sm text-black-200">
            {profile?.username ? (
              isPublic ? (
                <span>
                  {baseUrl ? `${baseUrl}/${profile.username}` : `/${profile.username}`}
                </span>
              ) : (
                <span>Profile is private. Make it public to share a URL.</span>
              )
            ) : (
              <span>Claim a username to unlock shareable URLs.</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-[0.3em] text-black-400" htmlFor="username-input">
            Username
          </label>
          <input
            id="username-input"
            value={username}
            onChange={(event) => setUsernameValue(event.target.value)}
            className="w-full rounded-full border border-black-700 bg-black-950 px-4 py-2 text-sm text-black-100"
            placeholder="yourname"
          />
        </div>
        <button
          type="submit"
          disabled={!isValid || isPending}
          className="rounded-full bg-white px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-black transition hover:brightness-95 active:brightness-90 disabled:opacity-50"
        >
          {isPending ? "Saving" : "Save"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-black-500">
        Use 3+ characters, letters and numbers only.
      </p>
      {message && <p className="mt-2 text-xs text-black-400">{message}</p>}
    </form>
  );
}
