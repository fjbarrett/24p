function normalizeUrl(value: string) {
  return value.replace(/\/$/, "");
}

export function getAppUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    (process.env.NODE_ENV === "production" ? "https://24p.mov" : "http://localhost:3000");
  return normalizeUrl(raw);
}

