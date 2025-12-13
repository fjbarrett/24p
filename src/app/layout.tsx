import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/session-provider";

export const metadata: Metadata = {
  title: "24p",
  description:
    "Log films, capture ratings, and share collaborative shelves with friends using Google sign-in.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        style={{ background: "#000" }}
      >
        <AuthProvider>
          <div className="mx-auto w-full max-w-[1000px]">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
