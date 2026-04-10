#!/bin/bash
# ============================================================================
# DeepSight — SSH Setup Script for Claude Code sessions
# ============================================================================
# Installs openssh-client and configures SSH keys from base64 env vars.
# Used by the SessionStart hook in .claude/settings.json.
#
# Required env vars (set in Claude Code project environment):
#   SSH_HETZNER_KEY_B64  — Hetzner VPS SSH key (base64-encoded)
#   SSH_GITHUB_KEY_B64   — GitHub deploy key (base64-encoded, optional)
#
# To generate base64 values (PowerShell):
#   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\33667\.ssh\id_hetzner"))
#   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\33667\.ssh\id_github_auto"))
# ============================================================================

set -e

# 1. Install openssh-client if missing
if ! command -v ssh &>/dev/null; then
  echo "[setup-ssh] Installing openssh-client..."
  apt-get update -qq && apt-get install -y -qq openssh-client >/dev/null 2>&1
  echo "[setup-ssh] openssh-client installed."
fi

# 2. Create ~/.ssh directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 3. Decode and write Hetzner SSH key
if [ -n "$SSH_HETZNER_KEY_B64" ]; then
  echo "$SSH_HETZNER_KEY_B64" | base64 -d > ~/.ssh/id_hetzner
  chmod 600 ~/.ssh/id_hetzner
  echo "[setup-ssh] Hetzner SSH key configured."
else
  echo "[setup-ssh] WARNING: SSH_HETZNER_KEY_B64 not set — Hetzner SSH unavailable."
fi

# 4. Decode and write GitHub SSH key (optional)
if [ -n "$SSH_GITHUB_KEY_B64" ]; then
  echo "$SSH_GITHUB_KEY_B64" | base64 -d > ~/.ssh/id_github
  chmod 600 ~/.ssh/id_github
  echo "[setup-ssh] GitHub SSH key configured."
fi

# 5. Write SSH config
cat > ~/.ssh/config << 'SSHCONFIG'
Host 89.167.23.214
  IdentityFile ~/.ssh/id_hetzner
  StrictHostKeyChecking no
  ConnectTimeout 10

Host github.com
  IdentityFile ~/.ssh/id_github
  StrictHostKeyChecking no
SSHCONFIG
chmod 600 ~/.ssh/config

echo "[setup-ssh] SSH setup complete."
