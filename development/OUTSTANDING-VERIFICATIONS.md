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

Per-version verification records live in `manual-tests/` — see its `README.md`.
