import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/session-provider";

export const metadata: Metadata = {
  title: "24p — your shared movie list",
  description:
    "Log films, capture ratings, and share collaborative shelves with friends using Google sign-in.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased text-slate-50"
        style={{ background: "radial-gradient(circle at 18% 0%, #111317, #050608 45%, #020303 100%)" }}
      >
        <AuthProvider>
          <div className="mx-auto w-full max-w-[1000px]">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
