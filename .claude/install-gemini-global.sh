#!/usr/bin/env bash
# Install the `gemini` skill globally so it works in EVERY Claude Code project
# on this machine (not just protocol-os). Run from the repo root:
#   bash .claude/install-gemini-global.sh
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${HOME}/.claude/skills/gemini"

echo "Installing global 'gemini' skill -> ${DEST}"
mkdir -p "${DEST}"
cp "${SRC}/skills/gemini/SKILL.md" "${DEST}/SKILL.md"

echo
echo "✅ Skill installed. It's now available in any Claude Code session as /gemini"
echo
echo "One-time prerequisites (do these once):"
echo "  1. Install Antigravity CLI from https://antigravity.google ; verify: agy --version"
echo "  2. Log in with your Ultra account:  agy   (opens browser OAuth)"
echo "  3. Allow agy without prompts — add this to ~/.claude/settings.json:"
echo '       { "permissions": { "allow": ["Bash(agy:*)"] } }'
echo
echo "Test from ANY folder:  /gemini  ask gemini to sanity check 2+2 and reply briefly"
