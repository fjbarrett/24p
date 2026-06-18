import "server-only";

// Derive a client identifier for rate-limiting.
//
// The LEFTMOST `X-Forwarded-For` entry is supplied by the client and is
// trivially spoofable — keying a limiter on it lets an attacker rotate the
// header to get a fresh bucket per request, defeating the limit entirely.
//
// Prefer headers that the trusted edge sets and overwrites on every request:
//   - `cf-connecting-ip` — set by Cloudflare, cannot be forged through CF.
//   - `x-real-ip` — commonly set by an nginx/Caddy reverse proxy.
// Only as a last resort fall back to the RIGHTMOST `X-Forwarded-For` hop (the
// one appended by our nearest trusted proxy), never the leftmost.
//
// Operational note: this is only as trustworthy as the edge. Ensure the
// production proxy (Cloudflare / nginx) sets cf-connecting-ip or x-real-ip and
// strips any client-supplied copy.
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last;
  }

  return "unknown";
}
