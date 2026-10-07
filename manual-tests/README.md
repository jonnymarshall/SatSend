# Manual test / verification records

One file per shipped version, named `vX.Y.Z[-H]-<slug>.md`, recording how the
change was verified — automated checks where possible, manual steps where not.
Add a file when you ship (a PR includes its verification record; see AGENTS.md).

Open work that these feed into is tracked in
[`../development/OUTSTANDING-VERIFICATIONS.md`](../development/OUTSTANDING-VERIFICATIONS.md).

## Integration harnesses (run locally)

- `npm run test:rls` — `../test-automation/rls-integration.mjs` — real RLS + the
  address-uniqueness RPC.
- `npm run test:db` — `../test-automation/db-invariants.mjs` — money/status
  invariants.

## Records

| Version | File |
|---|---|
| v1.4.1 | [v1.4.1-background-payment-polling.md](./v1.4.1-background-payment-polling.md) |
| v1.4.2 | [v1.4.2-public-invoice-realtime.md](./v1.4.2-public-invoice-realtime.md) |
| v1.4.3 | [v1.4.3-email-events-log.md](./v1.4.3-email-events-log.md) |
| v1.4.4 | [v1.4.4-email-recipient-and-sender.md](./v1.4.4-email-recipient-and-sender.md) |
| v1.4.9 | [v1.4.9-failed-email-surfacing.md](./v1.4.9-failed-email-surfacing.md) |
| v1.4.10 | [v1.4.10-invoice-activity-feed.md](./v1.4.10-invoice-activity-feed.md) |
| v1.4.12 | [v1.4.12-btc-address-hardening.md](./v1.4.12-btc-address-hardening.md) |
| v1.4.13 | [v1.4.13-payment-detection-latency.md](./v1.4.13-payment-detection-latency.md) |
| v1.4.16 | [v1.4.16-invoice-number-char-limit.md](./v1.4.16-invoice-number-char-limit.md) |
| v1.4.17 | [v1.4.17-invoices-pagination-state.md](./v1.4.17-invoices-pagination-state.md) |
| v1.4.18 | [v1.4.18-resend-webhook.md](./v1.4.18-resend-webhook.md) |
| v1.4.19-H | [v1.4.19-H-payment-amount-awareness.md](./v1.4.19-H-payment-amount-awareness.md) |
| v1.4.19.1-H | [v1.4.19.1-H-public-invoice-live-updates.md](./v1.4.19.1-H-public-invoice-live-updates.md) |
| v1.4.20-H | [v1.4.20-H-rls-critical-exposures.md](./v1.4.20-H-rls-critical-exposures.md) |
| v1.4.22-H | [v1.4.22-H-testnet-detection-e2e.md](./v1.4.22-H-testnet-detection-e2e.md) |
| v1.4.23-H | [v1.4.23-H-rls-and-indexes.md](./v1.4.23-H-rls-and-indexes.md) |
| v1.4.24-H | [v1.4.24-H-proxy-and-boundaries.md](./v1.4.24-H-proxy-and-boundaries.md) |
| v1.4.25-H | [v1.4.25-H-public-endpoint-hardening.md](./v1.4.25-H-public-endpoint-hardening.md) |
| v1.4.26-H | [v1.4.26-H-abuse-controls.md](./v1.4.26-H-abuse-controls.md) |
| v1.4.27-H | [v1.4.27-H-generated-types.md](./v1.4.27-H-generated-types.md) |
| v1.4.29-H | [v1.4.29-H-zod-typed-results.md](./v1.4.29-H-zod-typed-results.md) |
| v1.4.30-H | [v1.4.30-H-realtime-unification.md](./v1.4.30-H-realtime-unification.md) |
| v1.4.31-H | [v1.4.31-H-address-uniqueness.md](./v1.4.31-H-address-uniqueness.md) |
| v1.4.31.1-H | [v1.4.31.1-H-supabase-integration.md](./v1.4.31.1-H-supabase-integration.md) |
| v1.4.31.2-H | [v1.4.31.2-H-db-invariants.md](./v1.4.31.2-H-db-invariants.md) |
