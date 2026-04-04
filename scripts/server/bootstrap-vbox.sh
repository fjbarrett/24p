#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

DEPLOY_USER="${SUDO_USER:-deploy}"
SSH_SERVICE="ssh"
if systemctl list-unit-files | grep -q '^sshd\.service'; then
  SSH_SERVICE="sshd"
fi

apt-get update
apt-get install -y ca-certificates curl gnupg ufw fail2ban

install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

. /etc/os-release
cat >/etc/apt/sources.list.d/docker.list <<EOF
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable
EOF

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

usermod -aG docker "${DEPLOY_USER}"
install -d -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" -m 0750 /opt/24p

cat >/etc/ssh/sshd_config.d/24p-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PermitRootLogin no
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 3000/tcp
ufw --force enable

systemctl enable --now docker fail2ban ufw
systemctl reload "${SSH_SERVICE}"

echo "Bootstrap complete. Re-login as ${DEPLOY_USER} so docker group membership applies."
