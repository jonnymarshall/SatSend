# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.14.3] - 2026-05-08

### Migrations

- `0018_bitcoin_only.sql` — drops and recreates the `invoice_email_summary` view around the column drop. The view (from `0012`) does `select i.*` from `invoices`, which captures `accepts_bitcoin`; Postgres blocks `drop column` whenever a view references the column. Same drop-and-recreate dance that `0017` already used.

### Notes

- This was the second of two missed dependencies on `accepts_bitcoin` in the original `0018` design (the first was the offenders abort, fixed in v1.4.14.2). Migration was verified against remote with `npx supabase db push` BEFORE this PR was opened — local and remote tracking now both at `0019` with the schema change fully landed.
- New durable convention: future Supabase migrations get tested against remote *before* PR ceremony. Saved as a feedback memory.

## [1.4.14.2] - 2026-05-08

### Migrations

- `0018_bitcoin_only.sql` — edited to be self-healing. The original draft aborted on non-zero offenders (`status != 'draft' AND btc_address IS NULL`), assuming v1.4.14.1's `0019` would clean them up first. But the Supabase CLI applies migrations in filename order: `0018` ran before `0019` got a chance, hit the abort, and the deploy stalled. Replaced the `raise exception` with an inline `delete from invoices where status != 'draft' and btc_address is null` plus a `raise notice` so the deleted count is logged. Constraint add + column drop are unchanged. `0019` becomes a documented no-op (its delete matches zero rows on the next run, because `0018` already cleared them).

### Notes

- Editing a not-yet-applied migration file is safe; the CLI re-reads content on each push. The remote `_supabase_migrations` table never had `0018` recorded as applied because of the original abort.
- Anyone with a fresh checkout running `db push` after this branch lands sees a clean apply: `0018` (self-healing) → `0019` (no-op).

## [1.4.14.1] - 2026-05-08

### Migrations

- `0019_reconcile_pre_v1_4_12_invoices.sql` — deletes 24 abandoned test invoices that predate v1.4.12's publish-time `btc_address` requirement. They had `status != 'draft'` but `btc_address IS NULL`, which v1.4.14's `0018` migration's defensive audit refused to allow through. Inspected before deletion: all 24 had trivial totals, empty client_name, and test-style invoice_numbers (`TESTY`, `DRAFTY`, `FailedEmail`, etc.). Cascading deletes clean up related `email_events` and `invoice_events` rows automatically.

### Notes

- Hotfix-only: no code changes. After this lands, `npx supabase db push` re-runs 0018 cleanly (zero offenders) and the v1.4.14 constraint + column drop fully land.

## [1.4.14] - 2026-05-08

### Changed

- **Bitcoin-only focus.** The product pivots to a bitcoin-only invoicing positioning. The "Accept Bitcoin payment" checkbox is gone from the invoice form; the BTC address field renders unconditionally. Drafts may still be saved without an address; publishing requires one. Format validation runs whenever an address is set.
- **`canPublishInvoice` publish-gate function** (`src/lib/invoices/can-publish.ts`). Single source of truth for "is this invoice publishable" — used by the server actions and (transitively) by the form. Returns a discriminated union: ok / required / invalid.
- **Server actions enforce the publish-gate at every entry point.** `loadAndAuthorise` (used by `publishInvoice`, `publishAndSendEmail`, `publishAndMarkSent`) now runs `canPublishInvoice` unconditionally. The legacy `accepts_bitcoin && btc_address` short-circuit is gone.
- **Validation gates on `btc_address` presence alone.** `saveDraft`, `updateDraft`, and the form's `validate()` no longer consult the `accepts_bitcoin` flag. `validate(isPublish)` distinguishes draft-time (presence not required) from publish-time (presence required).
- **Display gates simplified across owner detail page, public payer page, and PDF.** Every place that read `invoice.accepts_bitcoin` now reads only `invoice.btc_address`. The `accepts_bitcoin` flag is no longer consulted anywhere in the codebase.
- **`invoice_published` email copy is bitcoin-centric.** Body explicitly says the invoice is "payable in bitcoin"; CTA renamed from "View invoice" to "View and pay". Other templates (`payment_detected`, `payment_confirmed`) already referenced Bitcoin context and need no change.

### Migrations

- `0015_fiat_and_manual_confirmation.sql` (cherry-picked from the abandoned fiat branch — already on remote).
- `0016_payment_confirmed_event_type.sql` (cherry-picked from the abandoned fiat branch — already on remote).
- `0017_revert_fiat_and_manual_confirmation.sql` — drops the columns / custom types added by 0015, recreates `invoice_status` without `marked_as_paid`, recreates `invoice_event_type` without `payment_confirmed`. Drops and recreates the `anon_select_non_draft` policy, `invoice_email_summary` view, and `invoices_btc_address_active_idx` partial index since they all referenced `invoices.status`.
- `0018_bitcoin_only.sql` — drops the `accepts_bitcoin` column and adds a `btc_address_required_when_published` CHECK constraint (`status = 'draft' or btc_address is not null`). Defensive abort if any non-draft rows lack an address. **Deploy ordering: this migration must be pushed AFTER the new code deploys, not before, so the currently-deployed pre-pivot writes do not fail.**

### Notes

- Marketing / landing copy is deliberately out of scope. A marketing page does not yet exist; building it is tracked as v1.4.23 and lands after v1.4.15 (rename to SatSend).
- Manual mark-as-paid escape hatches and partial-payment / under-overpayment handling are not in this release. The latter is queued as v1.4.19 (Payment Amount Awareness).
- The fiat-payment work originally scoped for v1.4.14 is preserved as a single WIP commit on `origin/v1.4.14/fiat-payment-and-manual-confirmation` (not merged), recoverable post-launch if revived.

## [1.4.13.7] - 2026-05-05

### Changed

- **`PaymentWatcher` no longer POSTs `payment-status` redundantly when the local status is already `payment_detected`** (or `paid`). Real-world testing on TEST 10 (already-detected invoices) showed 12 wasted POSTs per active payer over a 5-minute polling window: every active-poll tick GETted the same unconfirmed tx and re-POSTed `payment_detected` to our own backend. The route is idempotent, so this was harmless to data — but it was pointless network. Now the POST only fires on a real transition (`pending`/`overdue` → `payment_detected`, or any state → `paid`).
- Added a `statusRef` so the active-poll closure can read the latest status without re-running the effect (which would tear down the WebSocket every time the status changed).

### Notes

- The GET to mempool.space still fires on every poll — that's needed to detect the `payment_detected` → `paid` transition (block confirmation), which is the meaningful event we're watching for.
- Symmetric fix applied to both the REST poll branch and the WebSocket `address-transactions` branch in `payment-watcher.tsx`.

## [1.4.13.6] - 2026-05-05

### Changed

- **`saveDraft` and `updateDraft` now run the same address-uniqueness check that `loadAndAuthorise` (publish path) has run since v1.4.12.** Previously, drafts could be saved with a BTC address already used on another non-draft invoice in the user's account; the conflict only surfaced when the user later tried to publish, producing a confusing fail-late UX (save → ✅, publish → ❌). Now both paths reject up-front with the same message: `btc_address: This bitcoin address has already been used on invoice <ref>. Please provide a unique address.`
- Uniqueness check extracted into a reusable `assertAddressUniqueness(supabase, address, excludeInvoiceId?)` helper; called from `saveDraft` (no excludeId), `updateDraft` (excludes the row being edited), and `loadAndAuthorise` (excludes the row being published).

### Notes

- This finishes the symmetry begun in v1.4.12: both the freshness check (no on-chain history) and the uniqueness check (no other active paybitty invoice using this address) now fire at save time as well as publish time. No more save-then-publish mystery rejections.
- One extra DB query per save when `accepts_bitcoin` is on. Indexed lookup on `btc_address`, sub-millisecond.

## [1.4.13.5] - 2026-05-05

### Changed

- **Pre-mempool cron retry cadence tightened** in `src/lib/invoices/payment-schedule.ts`. Real-world testing surfaced a long-tail dead zone: when the cron's first poll at t=60s missed (because mempool.space's testnet indexer hadn't yet surfaced the broadcast tx), the next attempt was 5 minutes out. For a payer who closed the tab right after broadcasting, this meant ~5 minutes before the dashboard or detail page reflected the payment. Schedule:

  | Attempt | Pre-v1.4.13.5 (`stage_attempt` → next delay) | v1.4.13.5 (`stage_attempt` → next delay) |
  |---|---|---|
  | publish-time | +15 s | +15 s (unchanged) |
  | 0 → 1 | +5 min | **+30 s** |
  | 1 → 2 | +10 min | **+60 s** |
  | 2 → 3 | +30 min | **+2 min** |
  | 3 → 4 | stop | **+5 min** |
  | 4 → 5 | — | +10 min |
  | 5 → 6 | — | +30 min |
  | 6 → 7 | — | stop |

- Practical effect: cron-side polls in the first 5 minutes go from **2** (t=60s, t=300s) to **4–5** (t=60s, t=120s, t=180s, t=240s, t=300s — depending on cron tick alignment). For a typical testnet broadcast indexed at t=60–120s, detection now lands within ~2 min instead of ~5 min.

### Notes

- **API spend cost:** ~2 extra mempool.space requests per pending invoice per 5-min window. From a single Vercel-region IP. Headroom against mempool.space's free-tier ~60 req/min/IP limit is comfortable up to several hundred concurrent pending invoices.
- **Total polling lifetime extended:** previous schedule stopped at attempt 4 (~46 min cumulative). New schedule stops at attempt 7 (~48 min cumulative — similar overall window, just denser early).

## [1.4.13.4] - 2026-05-05

### Changed

- **Active alongside-WS poll switched from flat 5 s × 60 to phased cadence.** Total polls per real payment attempt drop from 60 to **25**, while the first minute (the dominant wallet-pay window) is unchanged at 5 s. The schedule mirrors the "Mark as Sent" button's front-loaded design but anchored on reveal instead of click:

  | Phase | Interval | Count | Phase duration | Cumulative |
  |---|---|---|---|---|
  | 1 | 5 s  | 12 | 60 s | 12 polls / 60 s |
  | 2 | 10 s |  6 | 60 s | 18 polls / 120 s |
  | 3 | 15 s |  4 | 60 s | 22 polls / 180 s |
  | 4 | 30 s |  2 | 60 s | 24 polls / 240 s |
  | 5 | 60 s |  1 | 60 s | **25 polls / 300 s — then stops** |

- Schedule lives in `ACTIVE_POLL_PHASES` in `src/app/invoice/[id]/payment-watcher.tsx`. Cadence selection is via pure helper `nextActivePollIntervalMs(count)`.

### Notes

- **API-spend savings:** under the v1.4.13.3 flat schedule a revealed payer who never paid would generate 60 mempool.space requests in 5 minutes. v1.4.13.4 cuts that to 25. For 100 daily payment attempts this is 3 500 fewer requests/day per active region.
- **Detection latency unchanged in the dominant window:** the first 60 seconds after reveal still polls at 5 s, matching the typical mobile-wallet pay flow. Slower payers (1–5 min after reveal) get progressively coarser polling but still get coverage.
- **Visibility pause unchanged:** all five phases respect `document.visibilityState`. Hidden tabs still pause polling and resume from the same poll count when visible.

## [1.4.13.3] - 2026-05-05

### Removed

- **Vestigial v1.4.13 WebSocket-close exponential-backoff fallback removed.** Once the v1.4.13.1 active alongside-WS poll (5s, capped at 60) was in place, the older 2s/4s/8s/16s/... fallback was redundant — for revealed payers it overlapped with the active poll producing irregular polling clusters (1s/3s/4s gaps observed in real-world testing); for unrevealed payers v1.4.13.2 already gated it off entirely. With this patch, the only client-side polling path is the active alongside-WS poll. Result: clean 5s cadence after reveal, no overlap, predictable 5-min auto-stop.

### Notes

- **Behaviour matrix (final v1.4.13.x):**
  - `paymentRevealed=false` + WS alive → WS only.
  - `paymentRevealed=false` + WS dead → no client polling. Cron is the safety net.
  - `paymentRevealed=true` + WS alive → active poll every 5s, capped at 60 polls (~5 min visible time) + WS.
  - `paymentRevealed=true` + WS dead → active poll every 5s, capped at 60 polls. **No exp-backoff fallback** ← removed in v1.4.13.3.
- After the active-poll cap is hit, polling stops entirely. The WS may still push if alive; otherwise the cron is the safety net (next pre-mempool check at +5min/10min/30min from publish per `PRE_MEMPOOL_DELAYS_MS`).

## [1.4.13.2] - 2026-05-05

### Changed

- **WebSocket-close fallback polling now also gated on `paymentRevealed`.** Previously, when mempool.space's WebSocket died (which happens routinely on testnet ~60s after open), the v1.4.13 exponential-backoff REST fallback would start polling indefinitely — even for window-shoppers who hadn't shown any intent to pay. With many concurrent viewers this compounded into wasted API spend. The fallback now no-ops while `paymentRevealed=false`; for unrevealed visitors we rely entirely on the server-side cron sweep, same as if they'd never opened the page. Symmetric with the v1.4.13.1 active alongside-WS poll, which already had this gating.

### Notes

- **Behaviour matrix now:**
  - Revealed + WS alive → active poll (5s × 60). Same as v1.4.13.1.
  - Revealed + WS dead → active poll + exp-backoff fallback. Same as v1.4.13.1.
  - Not revealed + WS alive → WS-only. Same as v1.4.13.1.
  - **Not revealed + WS dead → no client polling. Cron is the safety net.** ← changed from v1.4.13.1, was "exp-backoff fallback forever".

## [1.4.13.1] - 2026-05-04

### Added

- **Active alongside-WebSocket REST poll on the public payer page**, gated on payer commitment + tab visibility. Closes the "WS connected but silently missing pushes" gap that mempool.space's testnet WebSocket occasionally produces:
  - **When it runs:** only after the payer reveals the BTC address (clicks "Pay now in Bitcoin", or the invoice arrives already detected/paid). Window-shoppers cause zero polling load.
  - **Cadence:** one REST poll every 5 s, in parallel with the WebSocket. Caps at 60 polls (~5 minutes of *visible* polling time, then stops — relies on the WS + cron after that).
  - **Visibility-aware:** polling pauses immediately when `document.visibilityState === 'hidden'` and resumes when the tab returns. Prevents background tabs from pinging mempool.space forever.
- **Visibility gating extended to the v1.4.13 WebSocket-close fallback** as well — if the payer tabs away while the WS is dead and the exponential backoff is mid-cycle, the timer pauses and resumes on visibility return. Same pattern as the new active poll for consistency.

### Changed

- `PaymentWatcher` now accepts a `paymentRevealed?: boolean` prop, wired from `InvoicePaymentView` (`showPaymentDetails`). Default is `false` so the WS-only mode is the default for any other caller.

### Notes

- **Why this is small even at scale.** The mempool.space rate limit is per-IP. Page polling spreads across each viewer's own IP, while the cron polling all comes from one Vercel-region IP — so client-side polling is *much* cheaper to scale than server-side. Visibility gating is the highest-leverage saver here: it eliminates background-tab pings entirely.
- **Detection latency now (typical, page open + revealed):** 0–5 s. The active poll catches anything mempool.space's API has indexed even if their WS push silently dropped.

## [1.4.13] - 2026-05-04

### Changed

- **Payment detection latency narrowed for the "paid but didn't click the button" case.** When a payer broadcasts a tx and either closes the tab or has a flaky mempool WebSocket, end-to-end detection used to land in 60–120 s. Two cadence tightenings bring this to **p50 < 15 s, p95 < 60 s**:
  - `PaymentWatcher`'s WebSocket-fallback REST polling now starts at **2 s** (was 10 s) and doubles from there. Mirrors the front-loaded cadence the "Mark as Sent" button already used, so a tab-open payer with a dead socket sees detection on the same timeline.
  - `publishStatePatch` now schedules the first cron-side mempool poll at **publish + 15 s** (was +1 min). The publish action and `decidePaymentSchedule` now share `PRE_MEMPOOL_DELAYS_MS[0]` as a single source of truth — index 0 is the publish-to-first-check delay, indices 1+ remain the post-attempt-0 retry intervals (5/10/30 min).
- **Payer's mempool socket no longer rate-limits itself away.** The 10 s WebSocket-fallback was conservative because we feared mempool.space rate limits, but the button-clicked path was already pushing 2 s polling to the same endpoint without issues. No new ceiling needed.

### Fixed

- **Public payer page now renders the txid + mempool.space link the moment a payment is detected — no manual refresh required.** Previously `PaymentWatcher.onStatusChange` only forwarded the new status, dropping the `txid` it had already POSTed to `/api/invoices/[id]/payment-status`. The callback signature is now `(status, txid?)`, and `InvoicePaymentView` holds the txid in client state and consumes it in two complementary places: from the watcher (instant, no Supabase realtime needed) and from the realtime payload (covers the cron-only path when the payer's tab returns from the background). Both render sites — the primary BTC section and the BTC-price-error fallback — read from local state instead of the SSR prop.

### Notes

- Vercel Cron's per-job cadence is 1/minute on the deployed plan, so the worst-case "tab closed + mempool socket missed it" first-poll lands at **t+15 s..t+75 s** post-publish (15 s threshold + up to 60 s waiting for the next cron tick). Going below this would require a different scheduler — out of scope for v1.4.13.

## [1.4.12] - 2026-05-04

### Added
- **Pre-publish address freshness check.** Publishing now calls `GET /api/address/<addr>` on mempool.space (network-aware via `NEXT_PUBLIC_BTC_NETWORK`) and rejects any address with `chain_stats.tx_count > 0` or `mempool_stats.tx_count > 0`. Error: *"This address has already received transactions — use a fresh address for each invoice."* Defends against false-positive detections (a stale tx of the right amount marking the invoice as paid) and counterparty-privacy leaks from address reuse. New `addressHasHistory(address)` helper in `src/lib/mempool.ts` returning `true | false | null`; `null` means mempool.space is unreachable.
- **Fail-open on mempool downtime.** When `addressHasHistory` returns `null`, the publish proceeds with a logged warning (`[publish] mempool.space unreachable, address history check skipped for invoice <id>`). Owners are not blocked on an external dependency. The application-level uniqueness check (no address reuse across active invoices in the user's account) still runs and remains authoritative.
- **Network-aware mempool URL helpers.** New `mempoolTxUrl(txid)` and `mempoolAddressUrl(address)` in `src/lib/btc-network.ts`. Single source of truth for every mempool.space URL in the product — UI, emails, future PDFs.
- **Address-freshness check on save-draft and update-draft.** The same `addressHasHistory` call now fires from `saveDraft` and `updateDraft` (extracted into a shared `assertAddressFreshness` helper). Bad addresses bounce immediately at the save step rather than only at publish time. Same fail-open behaviour everywhere.
- **Server errors on save attach to the right field and scroll into view.** Refactored `handleSaveDraft` / `runPublishFlow` to share a `handleServerError(e)` helper. A server-side error formatted as `field: message` (e.g. `btc_address: ...`) now renders next to the corresponding form input and the page scrolls to it, matching the publish-flow behaviour.

### Fixed
- **`payment-status` route accepted transitions from any status (data-corruption hotfix).** The route's `STATUS_ORDER` map only had entries for `pending` / `payment_detected` / `paid`. For a `draft` invoice, `STATUS_ORDER["draft"]` was `undefined`, the `?? -1` fallback meant any incoming `paid` / `payment_detected` passed the gate, and the route would update the row before the payer even noticed. A `PaymentWatcher` running against a draft with a poisoned address could flip the draft straight to paid, send the payment-confirmed email, and write the wrong txid. Fixed in `src/app/api/invoices/[id]/payment-status/route.ts` with an explicit `PAYABLE_STATUSES` allow-list — only `pending`, `payment_detected`, `overdue` accept transitions; everything else returns 409 Conflict before the DB write.
- **Dashboard detail page mounted `PaymentWatcher` for drafts and archived invoices.** `src/app/(dashboard)/invoices/[id]/page.tsx` only checked `accepts_bitcoin && btc_address` when deciding whether to spawn the watcher, so opening a draft on the dashboard would start a WebSocket + polling loop against mempool.space and POST against the route once the on-chain tx surfaced. Now also gated on `status ∈ {pending, payment_detected, overdue}`.
- **Email mempool link 404'd on testnet.** `src/lib/email/send.ts` had its own `mempoolLink` helper that ignored `NEXT_PUBLIC_BTC_NETWORK` and emitted `https://mempool.space/tx/<txid>` regardless of network. On testnet the link 404'd or, worse, showed an unrelated mainnet tx of the same id. Replaced with `mempoolTxUrl` from `btc-network.ts`. Parity tests (`src/lib/email/send.test.ts`) render the email HTML under both networks and assert the URL matches what the UI renders.
- **Inline mempool URL on the mark-sent dialog.** `src/app/invoice/[id]/mark-sent-button.tsx` was constructing the address URL inline with `${getMempoolBaseUrl()}/address/<addr>`. Replaced with `mempoolAddressUrl`.

### Changed
- **README "Bitcoin address policy" section updated.** Flipped wording from "planned in v1.4.12" to a current statement of behaviour, including the mempool-down fallback rule.
- **Removed `NEXT_PUBLIC_MEMPOOL_BASE_URL` env var override.** It was only consulted by the email's homemade URL builder, which is gone. Single source of truth is now `NEXT_PUBLIC_BTC_NETWORK`.

### Out of scope (considered and rejected)
- **Soft-delete for invoices.** The original v1.4.12 plan added a `deleted_at` column + `'deleted'` enum value so a deleted invoice's BTC address would still block reuse. Dropped after a closer look: paid-and-deleted addresses always have on-chain history (the freshness check rejects them); unpaid-and-deleted addresses are harmless to reuse (no payment, no detection cross-talk). The narrow remaining case (paid → deleted within seconds → reused before tx confirms in mempool) is vanishingly rare and not materially worse than manual address reuse outside the system. The complexity cost of soft-delete (new enum, new column, query rewrites across list / detail / realtime / exports) wasn't earning its keep.

## [1.4.11] - 2026-04-29

### Added
- **Auto-flip past-due invoices to overdue.** The Vercel Cron `payment-sweep` endpoint now runs a second sweep on every tick: any `pending` invoice whose `due_date` is strictly before today's UTC date is flipped to `overdue` and recorded in the activity feed (`marked_as_overdue`) without owner intervention. The flip uses optimistic concurrency (`.eq("status", "pending")`) so a payment landing in the same tick wins. Decision logic lives in a new pure helper `decideOverdueFlip()` in `src/lib/invoices/overdue-actions.ts` (12 unit tests). Same-day invoices keep the rest of today before flipping.
- **Synchronous flip at publish time.** Publishing an invoice (`publishInvoice` / `publishAndSendEmail` / `publishAndMarkSent`) now calls `decideOverdueFlip` against the loaded invoice's `due_date` and writes `status='overdue'` directly when applicable, instead of writing `pending` and waiting for the next cron tick. Closes a UX gap where a freshly published invoice with a past due date appeared `pending` for up to ~60s in production (and indefinitely in dev, where the cron does not fire). Activity feed records `marked_as_overdue` in the same flow. (6 new unit tests in `actions.test.ts`.)
- **Source-of-truth helpers for the four overdue cases.** New `canMarkAsOverdue(invoice)` and `canMarkAsPending(invoice)` in `src/lib/invoices/overdue-actions.ts` encode the four cases in one place: (#1) past-due unpaid → cron auto-flips, no manual button; (#2) future-due unpaid → no manual button; (#3) no due date + unpaid → "Mark as overdue" available; (#4) no due date + overdue → "Mark as pending" available.

### Changed
- **`MarkAsMenu` is now due-date-aware.** Accepts a new `dueDate` prop and hides Overdue / Pending items per the four-cases helper. Paid → Unpaid stays always-on (unchanged). On overdue invoices the reverse item is now labelled "Pending" (was "Unpaid") to match the spec.
- **Invoice list row dropdown matches.** "Mark as overdue" no longer appears for pending rows that have a future due date (case #2), and a new "Mark as pending" item appears for overdue rows with no due date (case #4) wired to the existing `markUnpaid` server action.
- **Cron response shape.** `/api/cron/payment-sweep` now returns `{ processed, transitions, errors, overdueFlips }` (added `overdueFlips`).

### Out of scope
- **Email notification on auto-flip.** Owner sees the change on the next dashboard load (Realtime picks it up, activity feed records it). A Resend mailout for auto-overdue is deferred.
- **Configurable grace period.** The flip is the moment `due_date < today`. A "mark as overdue N days after due date" knob is deferred.
- **DB-side scheduled job.** A Postgres trigger / cron job would split state-transition ownership between TypeScript and the database; keeping it in the Next.js cron preserves a single source of truth and is simpler to test.

## [1.4.10] - 2026-04-29

### Documentation
- **Roadmap extended for payment-amount handling.** Added `v1.4.19 — Payment Amount Awareness (Under / Overpayment)` covering single-payment under/overpayment detection with a 5% tolerance band, fiat-denominated invoices, and a deferred-multi-payment architecture. Also added a "Bitcoin address policy" section to the README documenting the fresh-address requirement (publish-time enforcement planned in v1.4.12), and a README-update checklist item to v1.4.12.

### Changed
- **Email Activity card → Activity card.** The invoice detail page's per-invoice feed now covers manual state transitions in addition to email attempts. Four new event types — `marked_as_sent`, `marked_as_paid`, `marked_as_overdue`, `marked_as_unpaid` — are recorded server-side via a new `invoice_events` table (migration `0013_invoice_activity_events.sql`, RLS-scoped to the owner, service-role inserts only) whenever `publishAndMarkSent` / `markPaid` / `markOverdue` / `markUnpaid` runs. The card fetches both `email_events` and `invoice_events` in parallel, merges them most-recent-first, and renders each row with a distinct icon: envelope (Mail / AlertCircle for failed) for emails, paper-plane (Send) for marked-as-sent, green check-circle for marked-as-paid, clock for marked-as-overdue, rotate-ccw for marked-as-unpaid. Logging failures are swallowed so the primary state transition always succeeds. No backfill — pre-v1.4.10 invoices show only their email events. (`marked_as_unpaid` was added in migration `0014_invoice_event_type_unpaid.sql` after the initial enum was finalised; v1.4.14 will further gate the unpaid action to manually-confirmed invoices only.)

## [1.4.9] - 2026-04-29

### Added
- **Per-row email-failed indicator on `/invoices`.** A small destructive-tinted `AlertCircle` icon appears next to the status badge for any row whose last publish-email attempt failed, with a tooltip "Email failed to send to this client". On a row that was sent via email but the send failed, the failed indicator replaces the sent-method icon (single icon, not stacked).

### Changed
- **`/invoices` list page now reads from `invoice_email_summary` view.** New view (migration `0012_invoice_email_summary.sql`) left-joins `invoices` to the most-recent `invoice_published` row in `email_events`, exposing `last_publish_email_status`, `last_publish_email_error`, and `last_publish_email_at` as first-class fields. Single source of truth for "did the last publish email fail?" — the row-level indicator reads a real DB field rather than an app-derived flag, and a future Resend bounce/complaint webhook can update `email_events` and surface in the same UI without call-site changes. RLS is inherited from the underlying tables.

### Known limitation

- **Bounce / complaint state is still send-time only.** `email_events.status='failed'` means "Resend rejected the request at send-time". Post-acceptance bounces and spam complaints arrive via Resend webhooks, which remain out of scope. The detail page already surfaces the failure reason inside the **Email Activity** card (introduced in v1.4.3), so v1.4.9 deliberately doesn't duplicate that signal at the top of the detail page.

## [1.4.8] - 2026-04-29

### Added
- **Publish vs Send-via-email split.** Publishing an invoice (creating its public URL) is now decoupled from sending it via email. Owners get a split-button menu with four options for drafts: Send now via email, Download and mark as sent, Mark as sent, or Publish only. New `sent_at`, `send_method`, and `email_attempted_at` columns on `invoices` track delivery state without polluting the payment-status enum.
- **Send menu is state-aware.** It only shows actions still useful for the invoice's current state — once both `sent_at` and `email_attempted_at` are set the trigger is hidden entirely. After a manual mark-as-sent, only "Send now via email" remains in the menu (the manual options are no-ops once `sent_at` is set; the existing "Download PDF" affordance covers that path). The menu stays visible after a manual mark-as-sent even when `client_email` is empty so the user can see why "Send via email" is unavailable. "Send via email" is permanently disabled once an email attempt has been made (success or failure) — re-attempts are out of scope until `client_email` editing is supported.
- **Delivery indicators.** The detail page shows a "Sent via email on …" or "Marked as sent on …" line under the status badge; the `/invoices` Status column gets a small mail/hand icon next to the badge for at-a-glance method recognition.
- **Post-action feedback banners.** After "Send now via email" the detail page surfaces a green status banner ("Email queued for delivery to …") on Resend acceptance, and a red error banner on a Resend-side failure / missing API key / missing recipient. Replaces the previous easy-to-miss single-line text.
- **Publish/send menu on the new- and edit-invoice forms.** Replaces the single "Publish invoice" button on `/invoices/new` and `/invoices/[id]/edit` with the same `<PublishMenu>` split-button used on the detail page — same four draft options (Send via email, Download and mark as sent, Mark as sent, Publish only), same `client_email` gating. Each option saves/updates the draft first, then runs the chosen publish action and navigates to the detail page.

### Known limitation

- **Email Activity "Sent" = Resend-accepted, not inbox-confirmed.** When the activity card shows a `Sent` badge, it means the Resend API accepted the request — the email may still bounce later (invalid recipient, spam-block, etc.) and we won't know without a Resend webhook subscription. Resend webhooks are tracked as a separate follow-on (out of scope for v1.4.8 and v1.4.9).

## [1.4.7] - 2026-04-28

### Added
- **Drag-to-reorder line items on the invoice form.** Each line-item row now has a six-dot drag handle to its right. Owners can mouse-drag, long-press on touch, or keyboard-reorder (Tab to focus the handle, Space to pick up, Arrow Up/Down to move, Space to drop, Escape to cancel) on `/invoices/new` and `/invoices/[id]/edit`. Order is positional within the existing JSONB `line_items` array — no migration. Built on `@dnd-kit/core` + `@dnd-kit/sortable` (chosen over the deprecated `react-beautiful-dnd`, which has no React 19 support). Drag movement is constrained to the vertical axis within the list. Handle is hidden until row hover on desktop and always visible on mobile.

## [1.4.6] - 2026-04-28

### Changed
- **`your_email` on the invoice form is now locked to the session user's email.** `New Invoice` and `Edit Invoice` pages read `session.user.email` server-side and pass it as `sessionEmail` to `InvoiceForm`; the input renders `readOnly` and the value is forced from the session, ignoring any stale `initialValues.your_email`. This collapses the "two emails" confusion (account email vs invoice sender email). Per-invoice override is an explicit non-goal for v1.4.6 and is documented in a code comment.
- **Access codes are now lower-cased on input** (was uppercase). Typing `FoO12` becomes `foo12` — easier on mobile and less visually ambiguous. Placeholder updated to `e.g. mycode01`.
- **Payer access-code verification is now case-insensitive.** `isAccessCodeValid` lowercases both sides before comparing so legacy uppercase codes continue to work for any-case payer input. No DB migration is required.
- **Payer-facing access-code input now lowercases and clamps to 16 characters as the payer types**, matching the owner-side input. Visual feedback only — the verifier already accepts any case.

### Added
- **Bulk-archive feedback.** `bulkArchive` now returns `{ archived, skipped }`; the invoice data table surfaces a dismissable inline notice when any selected rows could not be archived (e.g. drafts or already-archived rows mixed into the selection), instead of silently dropping them.
- **`Mark as overdue` action on the `/invoices` per-row dropdown** for `pending` rows, mirroring the button on the invoice detail page.

## [1.4.5] - 2026-04-28

### Added
- **`Download PDF` action on the `/invoices` per-row dropdown** for non-draft rows. Reuses the existing `/api/invoices/[id]/pdf` endpoint, so users can download a PDF without navigating to the invoice detail page. Drafts stay excluded since they have no public URL/PDF.
- **`Download PDF` button on the public invoice page (`/invoice/[id]`)** so payers can save a copy without owner credentials. Wired to a new public, unauthenticated route `/api/invoice/[id]/pdf` which calls `fetchPublicInvoice` (returns null for drafts) and renders the same PDF as the owner endpoint. Drafts continue to 404.
- **PDF redesign with brand colours, dates, hyperlinks and BTC QR.**
  - Coloured header band using the brand primary (`#DE3C4B`), pulled from the new `src/lib/brand-colors.ts` module that mirrors the canonical hex values declared in `globals.css`. When the brand redesign updates `globals.css`, both surfaces update in lockstep.
  - **Date Created** and **Date Due** labels in the meta block; `Date Due` falls back to `"No due date"` when the invoice has none.
  - **View and pay online** clickable link to the public invoice URL (`<appUrl>/invoice/<id>`), so payers can jump from a printed/emailed PDF straight to the live page.
  - **BTC QR code** rendered into the Pay-with-Bitcoin block. The QR encodes a BIP-21 `bitcoin:<address>` URI **without** an amount (since the BTC amount depends on the spot price at payment time). The accompanying copy directs the payer to the public **View and pay online** page rather than to a third-party spot-price API — the public page already does the live conversion and shows an amount-encoded QR, so a separate calculation step is unnecessary.
- `renderInvoicePdf` now takes an `{ appUrl }` option; the route passes `getAppUrl()` from the shared email client helper.

### Changed
- **PDF filename format** changed from `invoice-<invoiceName>.pdf` to `<sender>_<invoiceName>_<YYYYMMDD>.pdf`, where:
  - `<sender>` = `your_company`, else `your_name`, else invoice `your_email` prefix, else the authenticated user's account email prefix, else literal `invoice`. Slashes/backslashes stripped, whitespace collapsed to `_`.
  - `<invoiceName>` = `invoice_number` if set, else the short id `…xxxxxxxx`.
  - `<YYYYMMDD>` = the invoice creation date in UTC.
- New helper `src/lib/invoices/pdf-filename.ts` is the single source of truth (full unit-test coverage in `pdf-filename.test.ts`). The download route emits both an ASCII `filename=` and an RFC 5987 `filename*=UTF-8''…` so filenames containing the unicode ellipsis travel correctly through HTTP headers.

## [1.4.4] - 2026-04-27

### Added
- **Payer now gets payment status emails.** When an invoice transitions `pending → payment_detected` or `payment_detected → paid`, the payer (`client_email`) receives a role-specific email alongside the owner, so the person who actually paid is no longer dependent on keeping the public invoice tab open. The payer-side send is silently skipped when `client_email` is blank.
- New role-specific templates: `src/lib/email/templates/payment-detected-owner.tsx`, `payment-detected-payer.tsx`, `payment-confirmed-owner.tsx`, `payment-confirmed-payer.tsx`. Owner copy is framed "your client paid invoice X"; payer copy is framed "your payment to {sender} has been detected / confirmed".

### Changed
- `sendPaymentDetectedEmail` and `sendPaymentConfirmedEmail` (`src/lib/email/send.ts`) now take `{ ownerEmail, payerEmail, senderName, ... }` and make up to two `safeSend` calls per transition. The single-recipient `to` field is gone. Both callsites — the fast-path payment-status route and the cron sweep — fetch the additional invoice columns (`client_email`, `your_name`, `your_company`, `your_email`) and resolve `senderName` the same way `publishInvoice` does.
- Old single `payment-detected.tsx` / `payment-confirmed.tsx` templates removed in favour of the four split templates above.

### Notes
- **Sender identity unified.** `EMAIL_FROM` is now `SatSend <team@mail.satsend.me>` (set in `.env` and Vercel project env vars). The Supabase custom SMTP **Sender** (Project Settings → Auth → SMTP Settings → Sender) is set to the same address so transactional mail and auth mail share a single `From:` identity. Pre-deployment checklist has a corresponding entry.
- README "Email notifications" updated: detected/confirmed rows now show **owner and payer** as recipients, and the SMTP note calls out the unified sender address.

## [1.4.3] - 2026-04-27

### Added
- **Email Event Log (DB-backed).** New `email_events` table records every transactional email the system tries to send: type (`invoice_published` / `payment_detected` / `payment_confirmed`), recipient, status (`queued` / `sent` / `failed` / `skipped_no_api_key`), Resend message id on success, error message on failure, and timestamps. Owner-scoped via RLS (`auth.uid() = user_id`).
- Migration `supabase/migrations/0010_email_events.sql` creates the enums, table, indexes, and RLS policy.
- **Email activity card** on `/invoices/[id]` lists every send attempt for that invoice with status, recipient, timestamp, and error detail (on hover) for failed attempts.

### Changed
- `safeSend` in `src/lib/email/send.ts` now takes an `EmailContext` (`invoiceId`, `userId`, `type`, `recipient`) and writes a row to `email_events` for every send attempt. Email send failures and DB write failures are best-effort and never block the parent flow.
- `publishInvoice`, the fast-path payment status route, and the cron sweep all pass `user_id` into the email helpers so events are owner-scoped.

### Notes
- README "What is *not* tracked" section rewritten to describe the new table and what Resend-side data (bounces, complaints) is still only available in the Resend dashboard.

## [1.4.2] - 2026-04-24

### Added
- **Public payer page live updates.** New `usePublicInvoiceRealtime` hook (`src/app/invoice/[id]/use-public-invoice-realtime.ts`) subscribes the unauthenticated `/invoice/[id]` page to Supabase Realtime UPDATE events for the invoice id and applies `payload.new` to local React state. Cron-driven (path C) and owner-driven status transitions now flip the payer's badge within ~1 second without a refresh. The on-page mempool WebSocket watcher remains the fastest path for transactions hitting the watched address.
- Migration `0009_anon_select_for_realtime.sql` adds an anon SELECT policy on non-draft invoices so Realtime delivers events to the public page under RLS. Draft invoices remain owner-only.
- `visibilitychange` → `router.refresh()` safety net on the public page, mirroring the dashboard hook.

### Changed
- README "Payment detection architecture" — added path **(E) Payer live updates**, removed the v1.4.1 disclaimer noting that path (C) changes wouldn't reach the payer without a refresh.

## [1.4.1] - 2026-04-23

### Added
- **Background payment polling via Vercel Cron.** A new `/api/cron/payment-sweep` endpoint polls mempool.space on a tiered per-invoice schedule so payment detection works even when neither the payer nor the owner has a page open. Pre-mempool cadence: 1m, 5m, 10m, 30m after publish (stops after ~46min). Post-mempool cadence (tx seen, unconfirmed): 10m ×3, 1h ×6, 4h ×12, 8h ×24, then stop after ~11 days.
- New pure scheduling function `decidePaymentSchedule(input, txs, now)` in `src/lib/invoices/payment-schedule.ts` — single source of truth for status transitions and next-check timing. Fully unit tested.
- `vercel.json` cron configuration — runs `/api/cron/payment-sweep` every minute in production.
- `CRON_SECRET` environment variable — bearer-token auth required on the cron endpoint; 401 otherwise.
- Migration `0008_background_payment_schedule.sql` adds `next_check_at`, `mempool_seen_at`, `stage_attempt` columns to `invoices` with a partial index on `next_check_at` for fast cron lookups. Existing `pending` / `payment_detected` rows are backfilled with `next_check_at = now() + 1 minute` so they pick up on first run.

### Changed
- `publishInvoice` now initialises scheduling columns alongside the status transition (`next_check_at = now() + 1m`, `stage_attempt = 0`, `mempool_seen_at = null`) so freshly published invoices enter the polling rotation immediately.
- `/api/invoices/[id]/payment-status` (the fast path triggered by the client-side mempool WebSocket watcher) now delegates to the same `decidePaymentSchedule` helper the cron uses — one shared state-update shape across both paths.

### Removed
- **Login sweep is gone.** `src/components/login-sweep-trigger.tsx`, `src/app/(dashboard)/sweep-action.ts`, and `src/lib/invoices/sweep.ts` deleted. Background cron is now the single source of truth for owner-offline / payer-offline transitions.

## [1.4.0] - 2026-04-22

### Added
- **Login sweep** — on dashboard mount (once per tab session), check every `pending` / `payment_detected` invoice against mempool.space to catch status transitions that happened while the user was offline. Confirmed-on-chain → `paid`; unconfirmed but broadcast → `payment_detected`. Clears the deferred item from v1.3.
- **Invoice PDF generation** — server-side rendering with `@react-pdf/renderer`. Exposes `renderInvoicePdf(invoice)` → `Buffer` with headers for parties, line items, totals, and the BTC payment block when `accepts_bitcoin` is true.
- **PDF download** — `GET /api/invoices/[id]/pdf` returns the invoice as `application/pdf`, auth-gated to the owner (scoped on both `id` and `user_id` so an attacker can't enumerate). New `Download PDF` button on `/invoices/[id]` for non-draft invoices.
- **Transactional emails** via Resend + React Email:
  - On publish → invoice link + access code sent to `client_email`.
  - On transition to `payment_detected` (0-conf) → notification to the invoice creator.
  - On transition to `paid` (1+ conf) → confirmation to the invoice creator.
  - Emails fire from both the client-side watcher path (`/api/invoices/[id]/payment-status`) and the login sweep, so the creator gets notified whether they were online or away.
  - Configured via `RESEND_API_KEY`. Missing key → email sends are silently skipped (a warning is logged) so the app still works in dev without email.
- `EMAIL_FROM` env var (optional, defaults to `Paybitty <onboarding@resend.dev>`), `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` env var (optional, for building absolute links in emails).
- **Log out button** in the dashboard nav header (right of the user email). Submits a server action that calls `supabase.auth.signOut()` and redirects to `/login`. Added during v1.4 testing to enable sign-in with a different account for Resend-account email matching.

### Notes
- Pre-deployment checklist added to `development/ROADMAP.md` — `RESEND_API_KEY` and other `.env` values need to be mirrored into Vercel project env vars before first deploy.
- Email dispatch uses a `safeSend` wrapper that catches and logs errors without failing the parent action — a broken email provider will never block a publish or a payment transition.

## [1.3.6] - 2026-04-22

### Added
- `/invoice/[id]` public payment view: copy button next to the BTC amount — one-click copy of the exact displayed amount (e.g. `0.01`, trimmed of trailing zeros) with the same "Copied" feedback used on the share-link copy button.
- `/invoice/[id]` public payment view: copy button next to the BTC address — one-click copy of the full address with the same "Copied" feedback.
- `CopyButton` gains an optional `label` prop that sets both `aria-label` and `title`, so multiple copy buttons on the same view remain distinguishable to screen readers and end users.

### Notes
- Password-manager icon suppression on `/invoices/new` identity fields was attempted (`data-lpignore`, `data-1p-ignore`, `autoComplete="off"`, `data-form-type="other"`) but reverted — LastPass injects its icon regardless when a field's label/id matches its autofill heuristics (name/email/company). The only workarounds that work (`type="search"` on identity fields, or dropping `type="email"`) break HTML semantics and native validation, so this item is marked won't-fix in the roadmap.

## [1.3.5] - 2026-04-22

### Added
- `Unarchive` action on the `/invoices` per-row dropdown for archived rows — reverts status to `pending` so the invoice rejoins the main list.
- `Clear Selected` button in the `/invoices` toolbar — visible whenever one or more rows are selected; clicking it clears the row-selection state without affecting filters or the archived toggle.
- `/invoices/[id]` dashboard detail page now mirrors every per-row dropdown action as an explicit button row at the bottom of the page (status-aware): Edit (draft), View public invoice + Copy public link (non-draft), Mark as sent (draft), Mark as paid, Archive / Unarchive, Duplicate, Delete. The existing dropdown on the list stays as-is; the detail page gets its own button surface.

### Changed
- Unarchiving now restores the original status (a paid invoice comes back as paid, an overdue one comes back as overdue) instead of defaulting to `pending`. Migration `0007_add_pre_archive_status.sql` adds a nullable `pre_archive_status` column that `bulkArchive` captures and `bulkUnarchive` consumes. Legacy archived rows with a NULL `pre_archive_status` fall back to `pending` on unarchive.
- Removed the redundant "Copy public link" button from the `/invoices/[id]` detail action row. The page's "Share with client" section already has a dedicated copy button next to the invoice URL, so the duplicate action row button was noise.

### Fixed
- Archiving a draft invoice no longer throws a `duplicate key value violates unique constraint "invoices_btc_address_active_idx"` error. The Archive action is now hidden on drafts in both the list dropdown and the detail page, and `bulkArchive` silently excludes drafts server-side (a pre-fetch filter on `status NOT IN ('draft','archived')`) as defense-in-depth for mixed bulk selections. Drafts aren't a valid thing to archive anyway — use Delete instead.

## [1.3.4] - 2026-04-22

### Added
- `Duplicate` action on the `/invoices` per-row dropdown — clones any invoice (draft, pending, paid, archived, etc.) into a fresh draft and navigates the user straight to the new invoice's edit page. Replaces the `Duplicate 🚩` placeholder shipped in v1.3.2.
- `duplicateInvoice(id)` server action copies all source fields into a new row with `status=draft`, clears `btc_address` and `btc_txid` (BTC addresses can't be reused across active invoices), preserves `access_code`, and appends ` (copy)` to `invoice_number` when the source has one (otherwise leaves it null). Access is scoped to the owning user.

### Changed
- Dropdown label `Duplicate 🚩` → `Duplicate` (placeholder flag removed).

## [1.3.3] - 2026-04-22

### Added
- `/invoices` list now live-updates via Supabase Realtime — when a payer's BTC payment is detected on the public invoice view, the freelancer's list row flips from "Pending" to "Payment Detected" within ~1s, without a manual refresh. Also covers INSERT and DELETE (new invoices from another tab, archives, bulk deletes). Works by subscribing the data-table to `postgres_changes` on `public.invoices` (RLS scopes events to the signed-in user) and calling `router.refresh()` on each event so the server component re-fetches fresh rows.
- `/invoices/[id]` dashboard detail page also live-updates via Supabase Realtime with a narrower filter (`id=eq.<invoiceId>`). Status badge, transaction ID link, and the action menu all reflect the current DB state within ~1s of the payer's confirmation — no manual refresh. A `key={invoice.status}` was added to the page's `PaymentWatcherUncontrolled` so its internal state resets when the server re-renders with a fresh status (prevents stale-badge edge case when another device detected the payment).
- Migration `0005_enable_invoices_realtime.sql` — adds `public.invoices` to the `supabase_realtime` publication so Realtime events are emitted. RLS policies (already in place) continue to scope events to the signed-in user.
- Migration `0006_invoices_replica_identity_full.sql` — sets `REPLICA IDENTITY FULL` on `public.invoices` so UPDATE events carry all column values. Supabase Realtime needs this for reliable event delivery when RLS policies inspect columns beyond the primary key.
- Realtime hook explicitly calls `supabase.realtime.setAuth(access_token)` before subscribing, closing a race where Realtime would connect unauthenticated and have events silently dropped by RLS.
- Realtime hook has a `visibilitychange` fallback: when the tab regains focus, it calls `router.refresh()` so the list still catches up if a Realtime event was ever missed.
- Diagnostic logging in the Realtime hook (`[invoice-realtime] ...`) — subscribe status, event receipt, and auth state — makes future connection issues easier to diagnose from the browser console.
- "Pay now in Bitcoin" reveal button on the public invoice view — QR code and address are now hidden behind an explicit click so the payer can review the invoice first. Auto-reveals if the invoice is already `payment_detected` or `paid` (so the txid link is visible without the extra click).
- "Mark as Payment Sent" button (shown once payment details are revealed) opens a dialog that actively polls mempool.space over 60 seconds with a front-loaded tiered schedule (15 polls: 5x2s + 5x3s + 3x5s + 2x10s)
- Polling dialog has three states: polling (with progress bar + "Cancel" button and helper text "Click here if you have not yet made the Bitcoin payment"), detected ("Your payment has been detected" with "OK"), and timed-out (with a link to view the address on mempool.space)
- When a payment is detected mid-polling, the progress bar animates to 100% for ~400ms before the dialog flips to the detected view — the payer gets a clear visual beat for the confirmation
- Detected dialog auto-opens even when the payer never clicked "Mark as Payment Sent" — if the background watcher catches the payment, the dialog still pops so the confirmation is unmistakable

### Changed
- `PaymentWatcher` is now a controlled component (accepts `status` + `onStatusChange` props instead of `initialStatus`); status is owned by the parent so the reveal button, the polling dialog, and the background watcher all stay in sync
- Background watcher's fallback polling first-delay reduced from 30s to 10s (still exponential backoff up to 10 minutes) so page-reload and long-open tab detection recovers faster when the WebSocket fails
- Added `console.warn` in the WebSocket `onerror` handler to surface testnet4 flakiness in the browser console

### Added (internal)
- `PaymentWatcherUncontrolled` wrapper for use in server-rendered pages that want the old "manages its own state" API (used by the dashboard invoice detail page)

## [1.3.2] - 2026-04-21

### Added
- `/invoices` list rebuilt as a shadcn Data Table (TanStack Table) with proper column headers, per-column sorting, row selection checkboxes, and column visibility toggle
- Always-visible toolbar: filter input (searches invoice # and client), Bulk actions dropdown (disabled until rows are selected), Show/Hide archived toggle, Columns dropdown
- Columns in order: Invoice, Client, Date Sent, Date Due, Amount, Status (all except Status sortable)
- Per-row actions menu (⋯) with status-aware items: View invoice, Edit (draft), View public invoice / Copy public link (non-draft), Mark as sent (draft), Mark as paid, Archive, Duplicate 🚩 (placeholder, tracked in v1.3.3), Delete
- Bulk actions dropdown: Mark as paid, Archive, Delete (same order as per-row actions)
- Delete confirmation now uses shadcn AlertDialog instead of the native browser prompt
- Pagination footer with "X of N invoices selected" and Previous/Next controls
- `archived` status added to the invoice status enum; archived rows hidden by default with a toggle to reveal them
- `bulkArchive`, `bulkDelete`, `bulkMarkPaid` server actions with ownership scoping
- Migration `0004_add_archived_status.sql` adds `archived` to the Postgres `invoice_status` enum
- shadcn components: `table`, `checkbox`, `dropdown-menu`, `input`, `alert-dialog`; dependency `@tanstack/react-table`

## [1.3.1] - 2026-04-21

### Added
- Invoice detail page now shows "Date Sent" and "Date Due" in the header area
- Client payment view now shows "Date Sent" alongside the existing "Due" date
- Invoice list now shows due date with "Due" prefix instead of creation date; invoices with no due date show "—"

### Fixed
- Due date formatting across all views now handles date-only strings correctly (no off-by-one-day in western timezones)
- Dashboard redirect test updated to reflect the `/dashboard` → `/invoices` redirect behaviour

## [1.1.5] - 2026-04-19

### Fixed
- Navbar "Paybitty" logo now links to `/invoices`
- Qty line item field rejects values above 100,000 or more than 2 decimal places
- Unit price line item field rejects values above 1,000,000,000 or more than 2 decimal places
- Date picker popover now renders at correct width (was incorrectly constrained to `w-auto`)
- Added `id` attributes to key UI elements across all pages for accessibility and testing
