#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

: "${GH_RUNNER_URL:?Set GH_RUNNER_URL to the repo or org URL}"
: "${GH_RUNNER_TOKEN:?Set GH_RUNNER_TOKEN to a GitHub registration token}"

RUNNER_VERSION="${RUNNER_VERSION:-2.329.0}"
RUNNER_USER="${RUNNER_USER:-deploy}"
RUNNER_HOME="${RUNNER_HOME:-/opt/actions-runner}"
RUNNER_LABELS="${RUNNER_LABELS:-24p-vbox}"

install -d -o "${RUNNER_USER}" -g "${RUNNER_USER}" -m 0755 "${RUNNER_HOME}"

tmpdir="$(mktemp -d)"
trap 'rm -rf "${tmpdir}"' EXIT

curl -fsSL -o "${tmpdir}/actions-runner.tar.gz" "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
tar -xzf "${tmpdir}/actions-runner.tar.gz" -C "${RUNNER_HOME}"
chown -R "${RUNNER_USER}:${RUNNER_USER}" "${RUNNER_HOME}"

cd "${RUNNER_HOME}"
sudo -u "${RUNNER_USER}" ./config.sh \
  --unattended \
  --url "${GH_RUNNER_URL}" \
  --token "${GH_RUNNER_TOKEN}" \
  --labels "${RUNNER_LABELS}" \
  --name "$(hostname)-24p-vbox" \
  --work "_work"

./svc.sh install "${RUNNER_USER}"
./svc.sh start

echo "GitHub Actions runner installed and started."
