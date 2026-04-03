"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

type SignInButtonProps = {
  variant?: "primary" | "ghost";
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
  borderless?: boolean;
};

export function SignInButton({
  variant = "primary",
  className = "",
  ariaLabel,
  children,
  borderless = false,
}: SignInButtonProps) {
  const { data: session, status } = useSession();
  const [pending, setPending] = useState(false);
  const callbackUrl =
    process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const label = useMemo(() => {
    if (pending) return "Connecting...";
    if (status === "loading") return "Checking session...";
    if (session?.user) return "Sign out";
    return "Sign in with Google";
  }, [pending, session?.user, status]);

  const styles = borderless
    ? "text-white"
    : variant === "primary"
      ? "bg-black-200 text-black-900 hover:bg-black-300"
      : "border border-white/20 text-white/75 hover:bg-white/8 hover:border-white/35 hover:text-white";

  async function handleClick() {
    if (session?.user) {
      setPending(true);
      await signOut();
      setPending(false);
      return;
    }

    setPending(true);
    if (callbackUrl) {
      await signIn("google", { callbackUrl });
    } else {
      await signIn("google");
    }
    setPending(false);
  }

  return (
    <button
      onClick={handleClick}
      className={`rounded-full px-5 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black-300 ${styles} ${className}`}
      disabled={pending}
      aria-label={ariaLabel ?? label}
    >
      {children ?? label}
    </button>
  );
}
