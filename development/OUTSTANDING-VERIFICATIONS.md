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
| Email deliverability: DMARC record `v=DMARC1; p=none;` at `_dmarc.satsend.me` | Done: live on Namecheap, Google and Cloudflare DNS (checked 2026-10-10) | Next: v1.5.0.4-H (quarantine, not before 2026-11-08) |
| `satsend.me` connected to Vercel | Live (2026-10-10), but Vercel made `www.satsend.me` the primary and redirects `satsend.me` → `www`. Make `satsend.me` primary (Vercel → Domains → edit `www.satsend.me` → redirect to `satsend.me`), so links, the Supabase redirect allowlist (`https://satsend.me/**`) and the brand all match | Pending (Jonny) |
| Supabase production (SatSend) Auth URLs: Site URL `https://satsend.me`, redirect `https://satsend.me/**`; Resend webhook → `https://satsend.me/api/webhooks/resend` | Done by Jonny (2026-10-10); re-check a magic-link login on `satsend.me` once it is primary | Login and bounce tracking on the new domain |
| Delete the internal UI kit (`src/app/styleguide/`, `SHOW_UI_KIT`) | Not done — do at the end of v1.5.2-H (moved from v1.5-H, 2026-10-10) | Launch (throwaway code must not ship) |

Per-version verification records live in `manual-tests/` — see its `README.md`.
