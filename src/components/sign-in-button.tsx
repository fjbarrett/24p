"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useMemo, useState } from "react";

type SignInButtonProps = {
  variant?: "primary" | "ghost";
  className?: string;
};

export function SignInButton({ variant = "primary", className = "" }: SignInButtonProps) {
  const { data: session, status } = useSession();
  const [pending, setPending] = useState(false);
  const label = useMemo(() => {
    if (pending) return "Connecting...";
    if (status === "loading") return "Checking session...";
    if (session?.user) return "Sign out";
    return "Continue with Google";
  }, [pending, session?.user, status]);

  const styles =
    variant === "primary"
      ? "bg-sky-400 text-slate-900 hover:bg-sky-300"
      : "border border-slate-500/50 text-slate-100 hover:border-slate-100";

  async function handleClick() {
    if (session?.user) {
      setPending(true);
      await signOut();
      setPending(false);
      return;
    }

    setPending(true);
    await signIn("google");
    setPending(false);
  }

  return (
    <button
      onClick={handleClick}
      className={`rounded-full px-5 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${styles} ${className}`}
      disabled={pending}
    >
      {label}
    </button>
  );
}
