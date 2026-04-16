"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "@/components/icons";

export function SignOutIconButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await signOut();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label="Sign out"
      title="Sign out"
      className="flex h-10 w-10 items-center justify-center rounded-full text-white/75 transition hover:bg-white/8 hover:text-white active:scale-[0.98] disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );
}
