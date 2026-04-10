# Commands

| Command | Description |
| `bun run build` | Production build + TypeScript verification for the Next-only app |
| `ssh deploy@192.168.56.3 "sudo bash /home/deploy/24p-bootstrap/scripts/server/bootstrap-vbox.sh"` | Bootstrap the VBox host with Docker, UFW, fail2ban, and SSH hardening |
| `TOKEN=$(gh api -X POST repos/fjbarrett/24p/actions/runners/registration-token --jq .token) && ssh deploy@192.168.56.3 "sudo env GH_RUNNER_URL=https://github.com/fjbarrett/24p GH_RUNNER_TOKEN=$TOKEN bash /home/deploy/24p-bootstrap/scripts/server/install-gh-runner.sh"` | Register and install the VBox self-hosted GitHub Actions runner |
| `ssh deploy@192.168.56.3 "sudo sh -lc 'command -v cloudflared || (mkdir -p --mode=0755 /usr/share/keyrings && curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null && echo \"deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main\" > /etc/apt/sources.list.d/cloudflared.list && apt-get update && apt-get install -y cloudflared)' && cloudflared --version"` | Install cloudflared on the VBox host |
