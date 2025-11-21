"use client";

import { useState, useTransition } from "react";

type UserRatingProps = {
  tmdbId: number;
  initialRating: number | null;
};

export function UserRating({ tmdbId, initialRating }: UserRatingProps) {
  const [rating, setRating] = useState(initialRating);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submit(value: number) {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, rating: value }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage(data.error ?? "Unable to save rating");
        return;
      }
      setRating(value);
      setMessage("Saved");
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
          <button
            key={value}
            onClick={() => submit(value)}
            disabled={isPending}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              rating === value
                ? "border-black-300 bg-black-200/10 text-black-100"
                : "border-black-700 text-black-200 hover:border-black-400/50"
            } ${isPending ? "cursor-wait opacity-60" : ""}`}
          >
            {value}
          </button>
        ))}
      </div>
      {message && <p className="text-xs text-black-500">{message}</p>}
    </div>
  );
}
