import Link from "next/link";
import { X } from "@/components/icons";

type SettingsShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function SettingsShell({ title, subtitle, children }: SettingsShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 text-black-100">
      <div className="w-full max-w-[560px] space-y-3 rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,26,26,0.98),rgba(13,13,13,1))] p-3 shadow-[0_36px_120px_rgba(0,0,0,0.72)] ring-1 ring-white/5 sm:p-5">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
            {subtitle ? <p className="text-sm text-black-400">{subtitle}</p> : null}
          </div>
          <Link
            href="/"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/6 text-black-200 transition hover:bg-white/12 hover:text-white active:bg-white/16"
            aria-label="Back to home"
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
