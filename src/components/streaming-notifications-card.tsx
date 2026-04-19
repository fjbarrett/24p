"use client";

import { useState, useTransition } from "react";
import { setStreamingNotifications, setPriceNotifications, type UserProfile } from "@/lib/profile-store";

type Props = {
  userEmail: string;
  profile: UserProfile | null;
};

function Toggle({
  label,
  description,
  value,
  onChange,
  isPending,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-sm text-black-400">{description}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(false)}
          disabled={isPending}
          className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
            !value
              ? "border-white/20 bg-white/14 text-white"
              : "border-white/10 bg-white/6 text-black-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          Off
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          disabled={isPending}
          className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
            value
              ? "border-white/20 bg-white/14 text-white"
              : "border-white/10 bg-white/6 text-black-300 hover:bg-white/10 hover:text-white"
          }`}
        >
          On
        </button>
      </div>
    </div>
  );
}

export function StreamingNotificationsCard({ userEmail, profile }: Props) {
  const [streaming, setStreaming] = useState(profile?.streamingNotifications ?? false);
  const [prices, setPrices] = useState(profile?.priceNotifications ?? false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateStreaming = (next: boolean) => {
    if (isPending || next === streaming) return;
    startTransition(async () => {
      try {
        setMessage(null);
        const updated = await setStreamingNotifications(userEmail, next);
        setStreaming(updated.streamingNotifications);
        setMessage(next ? "You'll be emailed when titles in your lists land on new platforms." : "Streaming notifications turned off.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update preference.");
      }
    });
  };

  const updatePrices = (next: boolean) => {
    if (isPending || next === prices) return;
    startTransition(async () => {
      try {
        setMessage(null);
        const updated = await setPriceNotifications(userEmail, next);
        setPrices(updated.priceNotifications);
        setMessage(next ? "You'll be emailed when movie prices drop on iTunes." : "Price drop notifications turned off.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update preference.");
      }
    });
  };

  return (
    <section className="space-y-4 rounded-[20px] border border-white/8 bg-white/[0.03] p-3 sm:p-4">
      <span className="text-[11px] uppercase tracking-[0.28em] text-black-500">Email notifications</span>

      <Toggle
        label="New on streaming"
        description="Email me when a title in my lists lands on a new streaming platform."
        value={streaming}
        onChange={updateStreaming}
        isPending={isPending}
      />

      <div className="border-t border-white/6" />

      <Toggle
        label="Price drops"
        description="Email me when a movie in my lists drops in price on iTunes."
        value={prices}
        onChange={updatePrices}
        isPending={isPending}
      />

      {message && (
        <p className="rounded-2xl border border-white/8 bg-black/30 px-4 py-3 text-xs text-black-300">{message}</p>
      )}
    </section>
  );
}
