# Commands

| Command | Description |
| `bun run build` | Production build + TypeScript verification for the Next-only app |
| `ssh deploy@192.168.56.3 "sudo bash /home/deploy/24p-bootstrap/scripts/server/bootstrap-vbox.sh"` | Bootstrap the VBox host with Docker, UFW, fail2ban, and SSH hardening |
| `TOKEN=$(gh api -X POST repos/fjbarrett/24p/actions/runners/registration-token --jq .token) && ssh deploy@192.168.56.3 "sudo env GH_RUNNER_URL=https://github.com/fjbarrett/24p GH_RUNNER_TOKEN=$TOKEN bash /home/deploy/24p-bootstrap/scripts/server/install-gh-runner.sh"` | Register and install the VBox self-hosted GitHub Actions runner |
