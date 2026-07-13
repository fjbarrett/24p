#!/usr/bin/env bash
# Origin hardening for the 24p droplet. Idempotent; run as a sudo-capable user
# from the repo checkout (or scp the scripts/server directory over first).
#
#   sudo bash scripts/server/harden-origin.sh
#
# What it does:
#   1. Installs the versioned nginx vhost + Cloudflare real-IP config and
#      refreshes the Cloudflare ranges from cloudflare.com/ips-*.
#   2. Restricts UFW 80/443 to current Cloudflare ranges (SSH 22 untouched).
#   3. Reloads nginx only if the config validates.
#
# Verification (from any machine NOT behind Cloudflare):
#   curl -m 5 -k https://<origin-ip>/        -> must time out (UFW drop)
#   curl -sI https://24p.mov/                -> 200 via Cloudflare
#   curl -sI http://24p.mov/ (via CF)        -> 301 to https

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── 1. Refresh Cloudflare ranges ─────────────────────────────────────────────
V4=$(curl -fsS --max-time 15 https://www.cloudflare.com/ips-v4)
V6=$(curl -fsS --max-time 15 https://www.cloudflare.com/ips-v6)
[ -n "$V4" ] && [ -n "$V6" ] || { echo "failed to fetch Cloudflare ranges" >&2; exit 1; }

{
  echo "# Cloudflare origin-pull ranges (refreshed $(date -u +%F) by harden-origin.sh)."
  echo "# Only these sources may assert the real client address."
  echo
  for cidr in $V4 $V6; do echo "set_real_ip_from $cidr;"; done
  echo
  echo "real_ip_header CF-Connecting-IP;"
} > /etc/nginx/conf.d/cloudflare-real-ip.conf

# ── 2. Install vhost ─────────────────────────────────────────────────────────
install -m 0644 "$REPO_DIR/nginx/24p-mov.conf" /etc/nginx/sites-available/24p-mov
ln -sf /etc/nginx/sites-available/24p-mov /etc/nginx/sites-enabled/24p-mov

nginx -t
systemctl reload nginx

# ── 3. UFW: 80/443 from Cloudflare only ──────────────────────────────────────
# Add the scoped allows first so Cloudflare traffic keeps flowing, then drop
# the blanket allows. Default incoming policy is deny.
for cidr in $V4 $V6; do
  ufw allow from "$cidr" to any port 80 proto tcp comment 'Cloudflare' >/dev/null
  ufw allow from "$cidr" to any port 443 proto tcp comment 'Cloudflare' >/dev/null
done

ufw delete allow 80/tcp >/dev/null 2>&1 || true
ufw delete allow 443/tcp >/dev/null 2>&1 || true

ufw status | head -40
echo "origin hardening applied"
