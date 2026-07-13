# HISTORY

---

## Context

**Last Updated:** 2026-07-13
**Stage:** Active development
**Purpose:** Film tracking and sharing app with web, iOS, and tvOS clients.
**Structure:**
`src/` Next.js app; `ios/` and `apple-tv/` native clients; `public/` assets; `.github/` CI/CD; `scripts/` operations.

---

## History

| Date | Agent | Action |
| ---- | ----- | ------ |
| 2026-07-13 | Codex GPT-5 | Assessed application, deployment, dependency, secret, and CI/CD security; reported prioritized findings without changing code. |
| 2026-07-13 | Claude Fable 5 | Completed comprehensive security remediation: device-approval pairing protocol (6-digit code approved from the web, high-entropy device credentials, 30d idle/180d absolute token expiry), browser-only privileged sessions, deny-by-default admin allowlist, DB TLS verify-full with CA + SHA-256 pin, Postgres-backed durable rate limits on public/expensive routes, JustWatch LRU + single-flight cache, Apple-link host validation, raw-error-message hygiene (publicError/routeError), share email removal, dependency bumps, SHA-pinned actions + tests + Dependabot + Trivy schedule, deploy timeouts, GitHub security features enabled, and Cloudflare-only origin (nginx real-IP overwrite + UFW allowlist, verified live). |

---

## Commands

| Command | Description |
| ------- | ----------- |
| `docker build --pull -t 24p-security-audit:local .` | Reproduce the production image for validation. |
| `trivy fs --scanners vuln,misconfig .` | Scan repository dependencies and configuration. |
| `trivy image --scanners vuln 24p-security-audit:local` | Scan the built runtime image. |
| `gitleaks git --redact .` | Scan committed history for secret-shaped content. |

---

## TODO

**Outstanding Tasks:**

- Watch the next Let's Encrypt renewal for 24p.mov (nginx authenticator now runs behind the Cloudflare-only UFW allowlist; renewal traffic flows through Cloudflare and should succeed — cert valid to 2026-09-08).
- Historical gitleaks hit: a generic API key in `examples/reelgood-source.html` at commit 93f1eeb (file long deleted). Rewriting history would require force-push approval; rotate the key if it was ever real.
- Refresh the UFW/nginx Cloudflare ranges occasionally via `scripts/server/harden-origin.sh`.

**Feature Ideas:**
