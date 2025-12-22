import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/session-provider";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000";
const description =
  "Literal Company helps you track films, capture ratings, and share collaborative shelves with friends.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Literal Company",
    template: "%s | Literal Company",
  },
  description,
  applicationName: "Literal Company",
  keywords: ["Literal Company", "film tracker", "movie lists", "movie ratings", "collaborative lists"],
  openGraph: {
    title: "Literal Company",
    description,
    type: "website",
    siteName: "Literal Company",
  },
  twitter: {
    card: "summary_large_image",
    title: "Literal Company",
    description,
  },
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
