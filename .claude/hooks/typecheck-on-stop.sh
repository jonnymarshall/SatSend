#!/usr/bin/env bash
# Stop hook: run the typecheck so a session never ends green-looking with a
# broken build. Surfaces failures as context; never blocks.
# Prove standalone: `.claude/hooks/typecheck-on-stop.sh`
set -uo pipefail

if out="$(npm run typecheck 2>&1)"; then
  exit 0
fi

tail="$(printf '%s' "$out" | tail -20 | tr '\n' ' ' | sed 's/"/\\"/g')"
printf '{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"typecheck FAILED — fix before ending: %s"}}' "$tail"
exit 0
