"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { rustApiFetch } from "@/lib/rust-api-client";

export function CreateListButton({ userEmail }: { userEmail: string }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("List title");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!expanded) return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 180);
    return () => window.clearTimeout(id);
  }, [expanded]);

  function handleExpand() {
    setExpanded(true);
    setError(null);
  }

  function collapse() {
    setExpanded(false);
    setError(null);
    setTitle("List title");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        setError(null);
        if (!userEmail.trim()) {
          setError("Sign in to create lists");
          return;
        }
        await rustApiFetch("/lists", {
          method: "POST",
          body: JSON.stringify({ title }),
        });
        collapse();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error");
      }
    });
  }

  return (
    <div className="flex w-full justify-center">
      <form
        onSubmit={handleSubmit}
        className="relative h-12 overflow-hidden rounded-full bg-white transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ width: expanded ? "100%" : "48px", willChange: "width", transform: "translateZ(0)" }}
      >
        <button
          type="button"
          onClick={handleExpand}
          aria-label="Create a new list"
          className="absolute top-0 flex h-12 w-12 items-center justify-center text-2xl font-light text-black transition-[left,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            left: expanded ? "0px" : "50%",
            transform: expanded ? "translateX(0)" : "translateX(-50%)",
          }}
        >
          +
        </button>

        <div
          className="absolute inset-0 flex items-center gap-2 pr-2 pl-12 transition-opacity duration-150"
          style={{ opacity: expanded ? 1 : 0, transitionDelay: expanded ? "170ms" : "0ms", pointerEvents: expanded ? "auto" : "none" }}
        >
          <input
            ref={inputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-black outline-none placeholder:text-black/40"
            maxLength={64}
            placeholder="New list title"
            aria-label="New list title"
          />
          <button
            type="button"
            onClick={() => setTitle("")}
            className="shrink-0 px-1 text-base text-black/40 transition hover:text-black"
            aria-label="Clear list title"
          >
            ✕
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="shrink-0 px-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            {isPending ? "…" : "Save"}
          </button>
        </div>
      </form>
      {error ? <p className="mt-2 text-center text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
