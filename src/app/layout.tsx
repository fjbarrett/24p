import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/session-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-slate-50`}
        style={{ background: "radial-gradient(circle at 18% 0%, #111317, #050608 45%, #020303 100%)" }}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
