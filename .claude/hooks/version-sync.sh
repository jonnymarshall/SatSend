#!/usr/bin/env bash
# PreToolUse(Bash) hook: before `gh pr create`, check that the branch's version
# is in package.json and CHANGELOG.md (version is bumped on the branch; tagging
# happens on merge — see the git-workflow skill). Warn-only.
# Prove standalone: `.claude/hooks/version-sync.sh`
set -uo pipefail

pkg="$(jq -r '.version // ""' package.json 2>/dev/null || true)"
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
want="$(printf '%s' "$branch" | sed -nE 's#^v?([0-9]+\.[0-9]+\.[0-9]+).*#\1#p')"
[ -z "$want" ] && exit 0

msgs=""
[ "$pkg" != "$want" ] && msgs="package.json is $pkg but the branch version is $want. "
grep -q "$want" CHANGELOG.md 2>/dev/null || msgs="${msgs}CHANGELOG.md has no entry for $want. "

if [ -n "$msgs" ]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"version-sync: %s"}}' "$msgs"
fi
exit 0
