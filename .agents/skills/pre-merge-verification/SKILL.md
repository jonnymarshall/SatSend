---
name: pre-merge-verification
description: Run the full quality gate before creating any PR. Use right before `gh pr create` (and after finishing a feature or fix). Runs tests, typecheck, lint, the rename guard, and scans for stray console.log/.only, then checks the CHANGELOG entry and the manual-test doc exist, and emits a pass/fail table.
---

# Pre-merge verification

Run before **every** `gh pr create`. Emit a pass/fail table and do not open the PR
if a hard gate fails.

| Gate | Command | Pass condition |
|---|---|---|
| Typecheck | `npm run typecheck` | 0 errors |
| Unit tests | `npm run test:run` | all green |
| Lint | `npm run lint` | 0 errors (warnings OK) |
| Rename guard | runs inside `test:run` (`src/rename-to-satsend.test.ts`) | living docs read SatSend |
| Stray debug | `grep -rnE "console\.log|\.only\(" src/` | empty |
| CHANGELOG entry | `grep "<version>" CHANGELOG.md` | branch's version present |
| Verification record | a `manual-tests/<version>-*.md` exists | present |

## Integration suites — when a PR touches migrations / RLS / grants

CI does **not** run these (local-only; they need the test project). If the PR
changes `supabase/migrations/`, RLS policies, or grants, run locally and paste the
output:

- `npm run test:rls` — real RLS + the address-uniqueness RPC (checks anon is
  denied, boolean return, cross-tenant backstop, tenant isolation).
- `npm run test:db` — money/status invariants.

## Then

Version bump is on the branch (`git-workflow`: bump on branch, tag on merge), so
`package.json` must already equal the branch version. Then open the PR.
