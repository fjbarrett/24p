# Commands

| Command | Description |
| `bun run build` | Production build + TypeScript verification for the Next-only app |
| `npm audit --omit=dev` | Query npm advisories for production dependency vulnerabilities |
| `TOKEN=$(gh api -X POST repos/fjbarrett/24p/actions/runners/registration-token --jq .token) && ssh deploy@<host> "sudo env GH_RUNNER_URL=https://github.com/fjbarrett/24p GH_RUNNER_TOKEN=$TOKEN RUNNER_LABELS=<label> bash -s" < scripts/server/install-gh-runner.sh` | Register and install a self-hosted GitHub Actions runner (set RUNNER_LABELS to `24p-dev` or `24p-prod`) |
| `ssh deploy@<host> "sudo mkdir -p --mode=0755 /usr/share/keyrings && curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null && echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list && sudo apt-get update -q && sudo apt-get install -y cloudflared"` | Install cloudflared on any server |
| `ssh deploy@<host> "cloudflared tunnel login"` | Authenticate cloudflared with Cloudflare (generates cert, run once per server) |
| `ssh deploy@<host> "cloudflared tunnel create <name> && cloudflared tunnel route dns <name> <hostname>"` | Create a named tunnel and route a hostname to it |
| `ssh deploy@<host> "sudo cloudflared service install && sudo systemctl enable --now cloudflared"` | Install cloudflared as a systemd service |
