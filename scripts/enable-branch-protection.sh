#!/usr/bin/env bash
# Enable branch protection on `main` so CI cannot be bypassed.
#
# Requires a repo ADMIN token (`gh auth status` must show admin:org / repo
# scopes). Run by the owner:
#     bash scripts/enable-branch-protection.sh                # jonnymarshall/SatSend
#     bash scripts/enable-branch-protection.sh owner/repo     # override
#
# Effect: the CI `verify` check must pass before a PR can merge; PRs must be
# up to date with main; direct pushes, force-pushes, and branch deletion on
# `main` are blocked — for everyone, including admins (enforce_admins = true).
# To let admins push in an emergency, set "enforce_admins" to false below.
set -euo pipefail

repo="${1:-jonnymarshall/SatSend}"

gh api -X PUT "repos/$repo/branches/main/protection" \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["verify"] },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "Branch protection enabled on $repo:main (required check: 'verify')."
