# Outstanding verifications

One tracker for things that must be verified but are not code changes. Each has a
status and what it blocks. (Code quality gates — tests, typecheck, lint — live in
the `pre-merge-verification` skill, not here.)

| Item | Status | Blocks |
|---|---|---|
| Mainnet end-to-end dry-run — real bitcoin through the full flow, including the external scheduler | Not done | Mainnet launch |
| v1.4.18 Resend webhook — tests 3 / 6 / 7 (`manual-tests/v1.4.18-resend-webhook.md`) | Not done | Reliable delivery/bounce tracking in prod |
| Resend webhook endpoint configured in production | Not confirmed | Bounce/complaint handling in prod |
| Wire the integration suites (`npm run test:rls`, `npm run test:db`) into CI | Deferred — local-only by decision (2026-10-07) | Continuous coverage (not launch-blocking) |
| Supabase project renamed off the pre-rename name (dashboard) | Not done | Cosmetic |
| Branch protection on `main` (require CI `verify`, block direct pushes) | Script ready — run `scripts/enable-branch-protection.sh` as owner | CI being unbypassable |
| Testnet wallet sweep (indices 300/500/1000/1001 → `m/84'/1'/0'/0/102`) | Not done | Retiring the test wallet (v1.4.36 leftover) |

Per-version verification records live in `manual-tests/` — see its `README.md`.
