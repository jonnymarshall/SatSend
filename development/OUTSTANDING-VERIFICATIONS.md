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
| Branch protection on `main` (require CI `verify`, block direct pushes) | Done (v1.4.34) | — |
| Testnet wallet sweep (indices 300/500/1000/1001 → `m/84'/1'/0'/0/102`) | Not done | Retiring the test wallet (v1.4.36 leftover) |
| Email deliverability: DMARC record at `_dmarc.satsend.me` should read `v=DMARC1; p=none;` (it held an SPF string by mistake). Edited 2026-10-11, but not yet live: Namecheap still served the old value when checked | In progress | Emails landing in inbox, not spam; then v1.5.0.4-H (quarantine, not before 2026-11-08) |
| Email deliverability: connect `satsend.me` to the Vercel project so email links match the sending domain. Links follow automatically after v1.5.4 (`getAppUrl`); also add the domain to Supabase (production project) Auth URLs and update the Resend webhook URL | Not done (v1.5.0.2-H) | Emails landing in inbox, not spam |
| Delete the internal UI kit (`src/app/styleguide/`, `SHOW_UI_KIT`) | Not done — do at the end of v1.5.2-H (moved from v1.5-H, 2026-10-10) | Launch (throwaway code must not ship) |

Per-version verification records live in `manual-tests/` — see its `README.md`.
