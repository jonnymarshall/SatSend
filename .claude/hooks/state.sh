#!/usr/bin/env bash
# Fast-feedback commit gate (warn-only). CI is the real, unbypassable gate.
#
# Invoked from .claude/settings.json:
#   state.sh edited        (PostToolUse Write|Edit)  — mark code as changed
#   state.sh verified      (PostToolUse Bash)        — mark the gate as run+passed
#   state.sh commit-gate   (PreToolUse  Bash)        — warn if edits are unverified
#
# Run standalone to prove it: `.claude/hooks/state.sh commit-gate`
set -uo pipefail

STATE_DIR=".claude/.state"

read_payload() { cat; }

case "${1:-}" in
  edited)
    mkdir -p "$STATE_DIR"; date +%s > "$STATE_DIR/edited"
    ;;
  verified)
    payload="$(read_payload)"
    cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // ""' 2>/dev/null || true)"
    case "$cmd" in
      *test:run*|*typecheck*|*"npm run lint"*|*test:rls*|*test:db*)
        err="$(printf '%s' "$payload" | jq -r '.tool_response.error // empty' 2>/dev/null || true)"
        if [ -z "$err" ]; then mkdir -p "$STATE_DIR"; date +%s > "$STATE_DIR/verified"; fi
        ;;
    esac
    ;;
  commit-gate)
    e="$STATE_DIR/edited"; v="$STATE_DIR/verified"
    if [ -f "$e" ] && { [ ! -f "$v" ] || [ "$e" -nt "$v" ]; }; then
      msg="Unverified edits since the last green run. Run \`npm run test:run\` and \`npm run typecheck\` before committing (CI will block the PR otherwise)."
      printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"%s"}}' "$msg"
    fi
    ;;
esac
exit 0
