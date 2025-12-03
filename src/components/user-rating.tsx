"use client";

import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import { rustApiFetch } from "@/lib/rust-api-client";

type UserRatingProps = {
  tmdbId: number;
  initialRating: number | null;
  userEmail?: string | null;
};

export function UserRating({ tmdbId, initialRating, userEmail }: UserRatingProps) {
  const normalizedEmail = useMemo(() => userEmail?.trim().toLowerCase() ?? "", [userEmail]);
  const [rating, setRating] = useState(initialRating);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submit(value: number) {
    if (!normalizedEmail) {
      setMessage("Sign in to rate this film.");
      return;
    }

    const previous = rating;
    setRating(value);
    startTransition(async () => {
      setMessage(null);
      try {
        await rustApiFetch("/ratings", {
          method: "POST",
          body: JSON.stringify({
            userEmail: normalizedEmail,
            ratings: [{ tmdbId, rating: value, source: "manual" }],
          }),
        });
        setMessage("Saved");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save rating");
        setRating(previous);
      }
    });
  }

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    submit(value);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1">
        <select
          id={`rating-${tmdbId}`}
          className="w-full max-w-[200px] rounded-xl g-black-900 px-4 py-2 text-sm text-black-100 shadow-sm transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
          value={rating ?? ""}
          onChange={handleChange}
          disabled={isPending || !normalizedEmail}
          style={{ fontSize: 24 }}
        >
          <option value="" disabled>
            {normalizedEmail ? (rating != null ? "Update rating" : "Select rating") : "Sign in to rate"}
          </option>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {value} / 10
            </option>
          ))}
        </select>
      </div>
      {message && <p className="text-xs text-black-500">{message}</p>}
    </div>
  );
}
