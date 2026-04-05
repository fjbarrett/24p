import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import { headers } from "next/headers";
import { AuthProvider } from "@/components/providers/session-provider";
import { getAppUrl } from "@/lib/app-url";
import { ScrollRestoration } from "@/components/scroll-restoration";
import { Suspense } from "react";

const appUrl = getAppUrl();
const description =
  "24p helps you track films, capture ratings, and share collaborative shelves with friends.";
const shouldIndex = process.env.NEXT_PUBLIC_NO_INDEX !== "true";
const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION;
const googleAnalyticsMeasurementId =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-6PH21R5KXN";
const shouldEnableAnalytics =
  process.env.NODE_ENV === "production" && shouldIndex && Boolean(googleAnalyticsMeasurementId);

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  ...(googleSiteVerification ? { verification: { google: googleSiteVerification } } : {}),
  title: {
    default: "24p",
    template: "%s | 24p",
  },
  description,
  applicationName: "24p",
  keywords: ["24p", "film tracker", "movie lists", "movie ratings", "collaborative lists"],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: shouldIndex,
    follow: shouldIndex,
    googleBot: {
      index: shouldIndex,
      follow: shouldIndex,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "24p",
    description,
    type: "website",
    siteName: "24p",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "24p",
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en">
      <body
        className="antialiased text-slate-50"
        style={{ background: "#000" }}
      >
        {shouldEnableAnalytics ? (
          <>
            <Script
              nonce={nonce}
              src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsMeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" nonce={nonce} strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${googleAnalyticsMeasurementId}');`}
            </Script>
          </>
        ) : null}
        <AuthProvider>
          <Suspense fallback={null}>
            <ScrollRestoration />
          </Suspense>
          <div className="mx-auto w-full max-w-[1000px]">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
