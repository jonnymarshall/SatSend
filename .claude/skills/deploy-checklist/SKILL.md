---
name: deploy-checklist
description: Pre-production deploy checklist for SatSend. Use before any production promote or launch. Walks the launch checklist, verifies env parity with `vercel env`, confirms the external cron fired, and that the Resend webhook endpoint is live.
---

# Deploy checklist

Run before promoting to production or marking launch-ready. Confirm each; stop on
any that is unknown.

## Environment

- [ ] `vercel env ls production` matches `.env.example` (no missing/extra vars).
- [ ] `NEXT_PUBLIC_BTC_NETWORK` is correct for production (a wrong value caused a
      real detection failure).
- [ ] `PAYMENT_SWEEP_ENABLED=true` in **exactly one** environment for this
      database (one writer per database — see AGENTS.md).

## Migrations

- [ ] Every merged migration is applied to production (check the migration table).
      Production drifted two releases behind once.

## Services

- [ ] The external scheduler (cron) fired recently — the sweep ran.
- [ ] The Resend webhook endpoint is live and configured in production.
- [ ] The webhook signing secret is set.

## Data / money

- [ ] A controlled real-bitcoin smoke test has passed on the target network.
- [ ] `development/OUTSTANDING-VERIFICATIONS.md` has no blocking items.

## After

- [ ] Tag + release per `git-workflow` (tag on merge).
