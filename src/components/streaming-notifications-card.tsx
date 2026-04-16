"use client";

import { useState, useTransition } from "react";
import { setStreamingNotifications, type UserProfile } from "@/lib/profile-store";

type Props = {
  userEmail: string;
  profile: UserProfile | null;
};

export function StreamingNotificationsCard({ userEmail, profile }: Props) {
  const [enabled, setEnabled] = useState(profile?.streamingNotifications ?? false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = (next: boolean) => {
    if (isPending || next === enabled) return;
    startTransition(async () => {
      try {
        setMessage(null);
        const updated = await setStreamingNotifications(userEmail, next);
        setEnabled(updated.streamingNotifications);
        setMessage(next ? "You'll receive emails when titles in your lists hit new platforms." : "Notifications turned off.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update preference.");
      }
    });
  };

  return (
    <section className="space-y-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-3 sm:p-4">
      <div className="space-y-1">
        <span className="text-[11px] uppercase tracking-[0.28em] text-black-500">Streaming notifications</span>
        <p className="text-sm text-black-400">
          {enabled
            ? "Email me when a title in my lists lands on a new streaming platform."
            : "Get an email when titles in your lists land on a new streaming platform."}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => toggle(false)}
          disabled={isPending}
          className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
            !enabled
              ? "border-white/20 bg-white/14 text-white"
              : "border-white/10 bg-white/6 text-black-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          Off
        </button>
        <button
          type="button"
          onClick={() => toggle(true)}
          disabled={isPending}
          className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
            enabled
              ? "border-white/20 bg-white/14 text-white"
              : "border-white/10 bg-white/6 text-black-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          On
        </button>
      </div>

      {message && (
        <p className="rounded-2xl border border-white/8 bg-black/30 px-4 py-3 text-xs text-black-300">{message}</p>
      )}
    </section>
  );
}
