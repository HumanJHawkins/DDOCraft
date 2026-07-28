#!/usr/bin/env bash
# Creates a dedicated Linux account for Claude's access to this dev/QA VM: full passwordless
# sudo (broad on purpose, per instruction - this is meant to cover unanticipated fixes, not a
# pre-enumerated task list), SSH-key-only login (no password auth at all for this account, same
# as any service account should have regardless of trust level).
#
# Run the whole thing as root (via sudo) - nearly every line needs it.
set -euo pipefail

CLAUDE_USER="claude"
CLAUDE_PUBKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGd/9zOrNBJIg3BJgHrXRv4OC1ylOMrBRh9PTQNm/MKJ claude@ddocraft-dev"

if ! id "${CLAUDE_USER}" &>/dev/null; then
    useradd -m -s /bin/bash "${CLAUDE_USER}"
fi

# Lock password login entirely - this account only ever authenticates via SSH key.
usermod -L "${CLAUDE_USER}"

install -d -m 700 -o "${CLAUDE_USER}" -g "${CLAUDE_USER}" "/home/${CLAUDE_USER}/.ssh"
echo "${CLAUDE_PUBKEY}" > "/home/${CLAUDE_USER}/.ssh/authorized_keys"
chmod 600 "/home/${CLAUDE_USER}/.ssh/authorized_keys"
chown "${CLAUDE_USER}:${CLAUDE_USER}" "/home/${CLAUDE_USER}/.ssh/authorized_keys"

# Full, passwordless sudo.
echo "${CLAUDE_USER} ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/${CLAUDE_USER}"
chmod 440 "/etc/sudoers.d/${CLAUDE_USER}"
visudo -c -f "/etc/sudoers.d/${CLAUDE_USER}"   # validate before trusting it - bad sudoers syntax is a bad time

echo ""
echo "Created Linux account '${CLAUDE_USER}' with full passwordless sudo and key-only SSH login."
echo "Test from the Windows box with:"
echo "  ssh -i ~/.ssh/ddocraft_claude ${CLAUDE_USER}@192.168.1.153"
