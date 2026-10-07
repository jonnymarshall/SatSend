#!/usr/bin/env bash
# PostToolUse(Write|Edit) tripwire: warn when the live roadmap grows past 40KB,
# so the archive discipline self-enforces.
# Prove standalone: `.claude/hooks/roadmap-size.sh`
set -uo pipefail

f="development/ROADMAP.md"
[ -f "$f" ] || exit 0
bytes="$(wc -c < "$f" | tr -d ' ')"
if [ "$bytes" -gt 160000 ]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"ROADMAP.md is %s bytes (> 160KB) — move completed sections into development/ROADMAP-ARCHIVE.md."}}' "$bytes"
fi
exit 0
