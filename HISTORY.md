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

- Address the prioritized security findings from the 2026-07-13 assessment.

**Feature Ideas:**
