# SatSend

Bitcoin-enabled invoicing for freelancers and small businesses.

---

## How payment detection works

> **The plain-English version.** Skip to "Detailed mechanics" further down if you want code references and timing tables.

### What we're trying to do

When a payer sends Bitcoin to an invoice, the invoice's status needs to change from **Pending** → **Payment Detected** → **Paid**. That status lives in our database. Two pages care about it:

- The **payer's page** at `/invoice/[id]` — public, anyone with the link can see it.
- The **owner's pages** under `/invoices` — private, only the logged-in invoice owner.

Both pages need to update **as soon as the status changes**, no matter who triggered it.

### A few terms first

| Term | What it means here |
|------|---------------------|
| **Mempool** | The "waiting room" for Bitcoin transactions. After a wallet broadcasts a tx but before a miner confirms it, it sits in the mempool. We use [mempool.space](https://mempool.space) as our window into it. |
| **Confirmation** | A miner has put the tx into a block. 0 confirmations = "broadcast, in mempool, not yet in a block". 1+ confirmations = "in a block on the chain". |
| **WebSocket** | A long-lived connection between your browser and a server that lets the server push messages **whenever something happens**. No need for the browser to keep asking. We use one to mempool.space and one to Supabase. |
| **Polling** | The opposite of a WebSocket. The browser (or server) repeatedly asks "anything new?" on a timer. Slower and chattier than a push, but works as a fallback when sockets aren't available. |
| **Cron** | A scheduled job. Vercel runs ours every minute, in the background, with no browser involved. Think of it as a server-side alarm clock that wakes up, checks the mempool for every active invoice, and goes back to sleep. |
| **Realtime (Supabase)** | A separate WebSocket from the browser to Supabase that delivers **database changes** as they happen. Anything that updates an invoice row anywhere in the system shows up on the page within ~1 second. |

### How a payment gets noticed (the three watchers)

There are exactly **three things** that can spot an incoming payment. Faster ones first.

> **Quick reference — what runs when (the three "payer on the page" states):**
>
> | State | What's running |
> |---|---|
> | Page open, hasn't clicked "Pay now in Bitcoin" (window-shopper) | mempool.space WebSocket only. **No REST polling.** |
> | Page open, clicked "Pay now in Bitcoin" (revealed), hasn't clicked "Mark as Sent" | WebSocket + **phased active poll**: 5 s × 12, 10 s × 6, 15 s × 4, 30 s × 2, 60 s × 1 = **25 polls over 5 minutes** then stops. (v1.4.13.4) |
> | Page open, clicked "Mark as Payment Sent" | WebSocket + the dialog's own front-loaded burst: 2 s × 5, 3 s × 5, 5 s × 3, 10 s × 2 = 15 polls over 60 s. |

#### 1. The mempool socket on the payer's page (sub-second, when it works)

When a payer opens `/invoice/[id]`, the page **immediately** opens a WebSocket to mempool.space and asks it to "track this BTC address". The connection stays open for as long as the page is open.

The moment a wallet broadcasts a payment to that address, mempool.space pushes a message down the socket. The page sends "I saw it" to our API, which writes `payment_detected` to the database.

> **You do not need to click the "Pay now in Bitcoin" button for this to work.** That button only reveals the QR code; the watcher runs in the background regardless. Closing the tab stops the watcher.

#### 2. The cron sweep (system-wide every minute, but each invoice on its own schedule)

There are **two clocks** here, and it's worth keeping them straight:

- **System clock** — Vercel Cron hits `/api/cron/payment-sweep` exactly once a minute, forever, regardless of how many invoices exist. This is what "every minute, no browser needed" refers to.
- **Per-invoice clock** — each invoice has its own scheduled next check (`next_check_at`). When the system clock fires, the endpoint **only checks invoices whose own scheduled time has come up** — typically a small handful per minute, not every outstanding invoice.

Each invoice's schedule is **front-loaded**, then tapers off:

- **Right after publish, no tx in mempool yet** — checks at **+15 s, +30 s, +60 s, +2 min, +5 min, +10 min, +30 min**, then **stops**. The invoice hibernates if nothing arrives in the first ~48 minutes. (The +15 s first-check is v1.4.13; the dense early retries are v1.4.13.5 — they replace the previous v1.4.13 schedule of `[15s, 5min, 10min, 30min]`, which left a 5-minute gap after the first cron miss.)
- **Once a tx hits the mempool** — schedule speeds back up: every 10 min × 3, then every 1 h × 6, then every 4 h × 12, then every 8 h × 24, over a total window of ~11 days.
- **A confirmed tx at any point** promotes the invoice straight to **Paid** and the schedule stops.

So: the cron itself runs every minute (system-wide), but a given invoice is **not** checked every minute — most of the time it's resting between scheduled checks. This avoids hammering mempool.space and burning cron compute on invoices nobody is paying.

This is what catches payments while everyone's tabs are closed. It's slower than the mempool socket (up to ~60 s for the next cron tick + however long mempool.space takes to see the tx + the per-invoice schedule gap) but it's tireless and unattended.

#### 3. The page's active REST poll (v1.4.13.1+, only after the payer clicks "Pay now in Bitcoin")

mempool.space's WebSocket sometimes appears connected but silently misses pushing a tx event to us — particularly on testnet. And the WS routinely dies after ~60s of inactivity. To close both gaps, the page fires REST polls **in parallel with the WebSocket**, on a **phased cadence** that mirrors the "Mark as Sent" button's front-loaded approach:

| Phase | Interval | Count | Phase duration | Cumulative |
|---|---|---|---|---|
| 1 | 5 s  | 12 | 60 s | 12 polls / 60 s |
| 2 | 10 s |  6 | 60 s | 18 polls / 120 s |
| 3 | 15 s |  4 | 60 s | 22 polls / 180 s |
| 4 | 30 s |  2 | 60 s | 24 polls / 240 s |
| 5 | 60 s |  1 | 60 s | **25 polls / 300 s — then stops** |

The first minute (the dominant wallet-pay window) keeps the fast 5 s cadence so a typical pay-and-watch flow gets sub-5-second detection. After 5 minutes of unsuccessful polling, the page stops polling entirely and falls back to the WebSocket (if alive) and the cron.

Two preconditions for any of these polls to fire:
- The payer has clicked "Pay now in Bitcoin" (or the invoice is already detected/paid), AND
- The tab is currently visible.

A window-shopper viewing a published invoice but never revealing the BTC details causes **zero** client-side polling load — only payers who've signalled intent to pay generate this traffic.

> **History:** v1.4.13 added a 2 s exp-backoff REST fallback fired only on WS-close. v1.4.13.1 added the always-on (when revealed) 5 s active poll. v1.4.13.2 gated the v1.4.13 fallback to revealed payers only. v1.4.13.3 removed the v1.4.13 fallback entirely — it overlapped with the active poll. v1.4.13.4 swapped the flat 5 s × 60 cadence for the phased 25-poll schedule above.

### How the badge moves (the push to your screen)

Spotting the payment is half the job. Once the database row changes, both the payer's and the owner's open pages need to **see** the change.

That's what Supabase Realtime is for. Both pages open a Realtime WebSocket when they mount. When the database row changes — by **any** of the three mechanisms above — Realtime pushes the new row down those sockets, and the badge updates within ~1 second.

So: a single status change can take three hops (mempool socket → API → database → Realtime → badge), but most of that is sub-second. The slowest link is **whoever spotted the tx**, not the push to the screen.

### Why a payment might take 30+ seconds to show up

The most common reason is **the mempool socket didn't catch it**, so you're waiting for the cron tick to find it instead. That happens when:

- The mempool socket connected but mempool.space hadn't yet seen the broadcast tx when the page asked. This is genuinely common — propagation takes 5–30 s.
- The mempool socket disconnected and the REST fallback hadn't been waiting long enough.
- You're on testnet, where mempool.space is slower and less reliable than mainnet.

When this happens, the cron eventually finds it → updates the database → Realtime pushes to the page → badge flips.

**Latency targets (v1.4.13):**

- **p50 < 15 s** — including the "paid but didn't click the button" case. The first cron-side check fires 15 s post-publish (down from 60 s).
- **p95 < 60 s** — the worst case is a closed tab + a missed mempool socket: bounded by the 1/min Vercel Cron tick falling after the +15 s threshold, so first poll lands at +15 s..+75 s.

### What happens when nothing is open

Just the cron, plus a tapering schedule. After publish, checks happen at **+15 s** (v1.4.13: was +1 min), then +5 min, +10 min, +30 min, then **stop** if nothing has hit the mempool — at that point we assume the payer has abandoned the invoice. As soon as a tx **does** hit the mempool, the cron speeds back up: 10 min ×3, then 1 h ×6, then 4 h ×12, then 8 h ×24, then stop after ~11 days. A confirmation at any point promotes the invoice straight to **Paid**.

### Two extras

- **"Mark as Payment Sent" button.** When a payer clicks this, the page polls mempool.space hard for 60 seconds (every 2 s, then every 3 s, then every 5 s, then every 10 s — 15 polls total) and shows a progress dialog. It's a UX polish: the payer sees confirmation right after they paid instead of waiting for the next mempool socket message. The watcher and the cron are still running underneath.
- **Visibility refresh safety net.** If you tab away for an hour and come back, the page does a quick refresh from the server in case the live socket missed anything while it was backgrounded.

---

## Bitcoin address policy

**Each invoice must use a fresh BTC receive address — one with no prior on-chain activity.** The assumption is that owners are running an HD wallet (Sparrow, BlueWallet, Ledger, etc.) that auto-derives a new receive address per invoice. Pasting in a reused address, an exchange deposit address, or any address that has already received Bitcoin is unsupported.

**Why fresh-only:**

- **Detection unambiguity.** The on-chain detector counts any tx at the address as the payment for this invoice. If the address has prior history, a stale tx of the right amount would falsely mark the invoice as paid.
- **Counterparty privacy.** Reusing an address across invoices ties multiple clients' payments to the same on-chain identity.
- **Simpler under/overpayment logic.** With fresh-only addresses we can compare the single received amount to the invoice total directly, without timestamp gating or per-tx attribution.

**Current enforcement:** the app rejects publishing an invoice if either of the following holds:

1. The BTC address is already used on another *active* (non-draft) invoice in the database (uniqueness check inside the user's account).
2. The address has any prior on-chain or mempool activity on the configured network — `chain_stats.tx_count > 0` or `mempool_stats.tx_count > 0` per `GET /api/address/<addr>` on mempool.space.

The on-chain freshness check is conditional on `NEXT_PUBLIC_BTC_NETWORK` — testnet addresses are validated against testnet4, mainnet addresses against mainnet.

**If mempool.space is unreachable:** the publish-time check fails open. We log a warning (`[publish] mempool.space unreachable, address history check skipped for invoice <id>`) and allow the publish to proceed — owners are not blocked on an external dependency. The uniqueness check (item 1) still runs and remains authoritative.

---

## Detailed mechanics

For the implementation specifics — file paths, exact intervals, code references — read on. The plain-English section above is enough to use and debug the system.

### Summary table

| Scenario                                                           | Active mechanism                         | Frequency                                     | Time-to-detect (typical)     |
|--------------------------------------------------------------------|------------------------------------------|-----------------------------------------------|------------------------------|
| (A1) Payer on `/invoice/[id]`, has **not** clicked "Pay now in Bitcoin" | Mempool WebSocket only | Real-time push; no client REST polling | < 1 second (push) |
| (A2) Payer clicked "Pay now in Bitcoin", has **not** clicked "Mark as Sent" | Mempool WebSocket + phased active alongside-WS poll | Real-time push; phased poll: 5s×12, 10s×6, 15s×4, 30s×2, 60s×1 = 25 polls / 5 min then stops (v1.4.13.4) | < 1 second (push) or ≤ 5 s (alongside poll) |
| (B) Payer on `/invoice/[id]`, **clicks** "Mark as Payment Sent"    | Tiered active polling for 60 seconds     | 5×2s + 5×3s + 3×5s + 2×10s = 15 polls in 60s  | 2–10 seconds                 |
| (C) Nobody has a page open                                         | Vercel Cron (background poll)            | Every minute, per-invoice back-off schedule   | 1–30 minutes pre-mempool; 10 min – 8 h post-mempool |
| (D) Owner on `/invoices` or `/invoices/[id]`                       | Supabase Realtime subscription           | Pushed as soon as any other path updates DB   | < 1 second after DB update   |
| (E) Payer on public `/invoice/[id]`                                | Supabase Realtime subscription (anon)    | Pushed as soon as any other path updates DB   | < 1 second after DB update   |

(A), (B), (C) are detection paths — they spot the on-chain payment. (D), (E) are display paths — they push the resulting database change to whatever page is open.

---

### (A) Payer on the page, passive

File: `src/app/invoice/[id]/payment-watcher.tsx`

1. Opens a **WebSocket to mempool.space** and subscribes to the invoice's BTC address.
2. On a **0-conf** event (tx broadcast) → POST `/api/invoices/[id]/payment-status` with `status=payment_detected`.
3. On a **1-conf** event (first confirmation) → POST with `status=paid`.
4. **Active alongside-WebSocket poll (v1.4.13.1, refined through v1.4.13.4):** when `paymentRevealed=true` (payer has clicked "Pay now in Bitcoin", or the invoice is already in a detected/paid state), the watcher *also* fires REST polls in parallel with the WS, on the v1.4.13.4 phased schedule (5 s × 12, then 10 s × 6, then 15 s × 4, then 30 s × 2, then 60 s × 1 = 25 polls over 5 min). Closes the "WS connected but silently missing pushes" gap. Stops entirely once all phases are exhausted; pauses while the tab is hidden. **This is the only client-side polling path.** The v1.4.13 exp-backoff fallback was removed in v1.4.13.3 — it was vestigial once the active poll covered the same cases.
5. The WebSocket is closed once the invoice reaches `paid`.
6. **Detected txid is pushed back to the view** via `onStatusChange(status, txid)`, so the public payer page can render the mempool.space transaction link the moment we report a payment — no manual refresh, no Supabase realtime roundtrip required (v1.4.13).

**Behaviour matrix for path A (final, v1.4.13.4):**

| Page state | WS state | Client-side polling |
|---|---|---|
| Window-shopper (not clicked "Pay now in Bitcoin") | alive | none — WS only |
| Window-shopper | dead | **none — cron is the safety net** |
| Revealed (clicked "Pay now in Bitcoin"), NOT clicked "Mark as Sent" | alive or dead | **Phased active poll: 5 s × 12 → 10 s × 6 → 15 s × 4 → 30 s × 2 → 60 s × 1 = 25 polls over 5 min, then stop.** Same cadence regardless of WS state. |
| Clicked "Mark as Sent" | (n/a — dialog handles this) | Dialog's front-loaded 60 s burst (path B). The active poll continues underneath. |

**Latency:** effectively instant (push). Fallback polling only kicks in if the socket dies.

---

### (B) Payer on the page, clicked "Mark as Payment Sent"

Files: `src/app/invoice/[id]/mark-sent-button.tsx` + dialog component.

Opens a dialog that **actively polls mempool.space for exactly 60 seconds** on a front-loaded schedule:

| Phase | Interval | Count  | Running total |
|-------|----------|--------|---------------|
| 1     | 2 s      | 5      | 10 s          |
| 2     | 3 s      | 5      | 25 s          |
| 3     | 5 s      | 3      | 40 s          |
| 4     | 10 s     | 2      | 60 s          |
| **Total** | —    | **15 polls** | **60 s**  |

States:
- **Polling:** progress bar + Cancel button with helper text.
- **Detected:** progress bar animates to 100 % for ~400 ms, then flips to *"Your payment has been detected"* + OK.
- **Timed out:** informational state with a link to mempool.space so the payer can self-verify.

The detected dialog also **auto-pops** on any `pending/overdue → payment_detected/paid` transition, even if the payer never clicked the button — so if the cron (path C) or the passive watcher (path A) fires while the dialog is open, the dialog still resolves with confirmation.

---

### (C) Nobody has a relevant page open

Files: `src/app/api/cron/payment-sweep/route.ts` + `src/lib/invoices/payment-schedule.ts` + `vercel.json`.

A Vercel Cron hits `/api/cron/payment-sweep` **every minute** (`* * * * *`). **Note: Vercel Cron only fires in deployed environments — locally (`npm run dev`), the route exists but nothing calls it automatically.** For local manual testing, run the curl loop documented in `manual-tests/v1.4.13-payment-detection-latency.md` (Setup → Cron requirement). The endpoint:

1. Bearer-auths the incoming request against `CRON_SECRET`.
2. Fetches up to **50 invoices** where `next_check_at <= now()` AND `status IN ('pending', 'payment_detected')`.
3. For each, calls mempool.space's `GET /api/address/<addr>/txs`, then runs the pure decision function `decidePaymentSchedule(…)` which produces the next state and the next `next_check_at`.
4. Writes the decision with optimistic concurrency (`.eq('status', prior)`).
5. If the status changed, dispatches a "Payment detected" or "Payment confirmed" email via Resend.
6. Runs a sibling **overdue sweep** (`sweepOverdue` helper, decision lives in `src/lib/invoices/overdue-actions.ts`): any `pending` invoice whose `due_date` is strictly before today's UTC date is flipped to `overdue` and the transition is recorded in the activity feed (`marked_as_overdue`). Independent of mempool — the sweep runs even if the payment-poll loop has errors. Cron response includes an `overdueFlips` counter.

The per-invoice schedule is **two-stage**:

**Pre-mempool** (`mempool_seen_at IS NULL` — nothing broadcast yet). After publish, checks at +15 s, +30 s, +60 s, +2 min, +5 min, +10 min, +30 min. If still nothing by ~48 minutes total, polling stops for that invoice (the passive watcher and the fast-path API still work if the payer returns to the page). The intervals live in `PRE_MEMPOOL_DELAYS_MS` (`src/lib/invoices/payment-schedule.ts`); index 0 is the publish → first-check delay, consumed by `publishStatePatch` in `src/app/(dashboard)/invoices/actions.ts` so there is a single source of truth.

| Attempt | Delay from previous | Elapsed since publish |
|---------|---------------------|-----------------------|
| 1       | + 15 s              | 15 s                  |
| 2       | + 30 s              | 45 s                  |
| 3       | + 60 s              | 1 min 45 s            |
| 4       | + 2 min             | 3 min 45 s            |
| 5       | + 5 min             | 8 min 45 s            |
| 6       | + 10 min            | 18 min 45 s           |
| 7       | + 30 min            | 48 min 45 s           |
| —       | stop (`next_check_at = null`) | —           |

> **Note on the cron tick.** Vercel Cron fires the `payment-sweep` route exactly once per minute. The schedule's per-attempt delay is the *earliest* moment the invoice is eligible — the actual poll lands on the next minute boundary after that. So the dense early entries (15 s, 30 s, 60 s) translate into roughly one cron poll per minute boundary in the first ~3 minutes, giving cron-side detection within ~2 minutes for a typical testnet broadcast that mempool.space indexes at t=60–120 s.

> **Pre-v1.4.13.5 history.** The schedule used to be `[15 s, 5 min, 10 min, 30 min]` — i.e. only *two* polls in the first 5 minutes. If mempool.space hadn't indexed the broadcast tx by the t=60 s first-poll window (very common on testnet), the next attempt was 5 minutes out. v1.4.13.5 fills in that gap.

**Post-mempool** (`mempool_seen_at IS NOT NULL` — tx broadcast but not confirmed). Cadence spreads the checks over ~11 days:

| Stage | Interval | Count | Stage duration | Cumulative polls |
|-------|----------|-------|----------------|------------------|
| 1     | 10 min   | 3     | 30 min         | 3                |
| 2     | 1 h      | 6     | 6 h            | 9                |
| 3     | 4 h      | 12    | 48 h           | 21               |
| 4     | 8 h      | 24    | ~8 days        | 45               |
| —     | stop     | —     | —              | —                |

Total post-mempool window before giving up: ~11 days. Any confirmed tx seen at any point promotes the invoice straight to `paid` and `next_check_at = null`.

The fast-path route `/api/invoices/[id]/payment-status` (triggered by path A) **delegates to the same `decidePaymentSchedule` helper**, so whichever path fires first writes the same row shape — the two systems stay in lock-step.

---

### (D) Owner live updates

File: `src/app/(dashboard)/invoices/use-invoice-realtime.ts`

- Subscribes to Supabase Realtime UPDATE events on the `invoices` table for rows owned by the current user.
- Migration `0006_invoices_replica_identity_full.sql` sets `REPLICA IDENTITY FULL` so UPDATEs carry every column — essential for reliable Realtime delivery behind RLS.
- The hook explicitly calls `supabase.realtime.setAuth(access_token)` before subscribing; without this RLS silently drops events.
- `visibilitychange` → `router.refresh()` is the safety net for silent socket drops.

Works on both `/invoices` (list) and `/invoices/[id]` (detail). Any DB update from any other path (watcher, fast-path route, cron) appears on the owner's UI within ~1 second.

---

### (E) Payer live updates

File: `src/app/invoice/[id]/use-public-invoice-realtime.ts`

- **As of v1.4.20-H (S1), this no longer uses `postgres_changes`.** The anon
  key has no SELECT policy on `invoices` at all (the audit found the prior
  blanket policy exposed every non-draft invoice's full row, including
  `access_code`, for far more than the payer page actually needed). Instead, a
  trigger on `invoices` (migrations `0022_close_anon_exposures.sql`,
  `0023_broadcast_guard_and_authorization.sql`) calls
  `realtime.broadcast_changes()` on every non-draft UPDATE, sending a minimal
  `{id, status, btc_txid}` record to a broadcast channel named `invoice:<id>`.
  Draft invoices never broadcast at all.
- The page subscribes to that channel with the **anon** key, opening it with
  `{ config: { private: true } }`. `realtime.broadcast_changes()` sends via
  `realtime.send()`, which defaults broadcasts to private — an RLS policy on
  `realtime.messages` (not `invoices`) authorizes anon to receive messages on
  topics matching the `invoice:<uuid>` pattern.
- The hook surfaces `payload.payload.record` (`status`, `btc_txid`) to the
  page, which applies them to local React state — so the badge moves without a
  `router.refresh()` (which would re-run the server fetch and clobber other
  in-flight UI state).
- `visibilitychange` → `router.refresh()` is the safety net for silent socket drops.
- The on-page mempool watcher (path A) is still the fastest source for transactions hitting the watched address; this path is the catch-all for cron-driven (path C) and owner-driven (e.g. mark-as-paid) transitions the watcher can't see.

---

## Publishing and sending an invoice

Publishing an invoice (creating its public URL) is **decoupled** from sending it via email. The owner picks how delivery should happen via a single split-button menu on the invoice detail page and the `/invoices` per-row dropdown.

Three columns on `invoices` capture delivery state without polluting the payment-status enum (which stays focused on `pending → payment_detected → paid`):

- `sent_at` — non-null once the invoice has been "delivered" (manually or via successful email).
- `send_method` — `'email'` or `'manual'`; non-null when `sent_at` is set.
- `email_attempted_at` — set the moment a `safeSend` for `type=invoice_published` is fired, regardless of outcome. Used to gate the "Send via email" option.

The menu shows only actions that are still useful for the invoice's current state:

| State | Trigger | Menu options |
|---|---|---|
| Draft | **Publish** | Send via email · Download and mark as sent · Mark as sent · Publish only |
| Published-only (`sent_at` NULL) | **Send** | Send via email · Download and mark as sent · Mark as sent |
| Manually-marked-sent (`sent_at` set, `email_attempted_at` NULL) | **Send** | Send via email *(only — disabled with tooltip if no `client_email`)* |
| Email attempted but failed (`email_attempted_at` set, `sent_at` NULL) | **Send** | Send via email *(disabled)* · Download and mark as sent · Mark as sent |
| Successfully delivered via email (`sent_at` + `email_attempted_at` both set) | (hidden) | — |
| Manually sent + email attempted (both set) | (hidden) | — |
| Archived | (hidden) | — |

Notes:
- Once `email_attempted_at` is set, "Send via email" is permanently disabled with a tooltip — re-attempts would hit the same `client_email`, which is currently immutable post-publish.
- After a manual mark-as-sent the manual options ("Mark as sent", "Download and mark as sent") drop out because they are no-ops; the existing **Download PDF** button on the detail page / row dropdown handles that affordance.
- The `Send` trigger disappears entirely once *every* path is a no-op (both `sent_at` *and* `email_attempted_at` set).
- "Sent" in the **Email Activity** card means **Resend accepted the request**, not that the recipient inbox confirmed receipt. Bounces / spam-blocks that occur post-acceptance are not currently surfaced — that needs a Resend webhook subscription, tracked in `development/ROADMAP.md` as **v1.4.18 — Resend Webhook: Sent vs Delivered vs Bounced**.

Three server actions back the menu (`src/app/(dashboard)/invoices/actions.ts`):

- `publishInvoice(id)` — publish only, no delivery side-effect.
- `publishAndSendEmail(id)` — publish + fire `invoice-published` email; returns `{ emailStatus }` so the UI can show success/failure.
- `publishAndMarkSent(id, { withDownload? })` — publish + record manual delivery. With `withDownload: true`, returns `{ downloadUrl }` so the client triggers the existing `/api/invoices/[id]/pdf` route.

All three route through `applyPublishUpdate`, which calls `decideOverdueFlip` against the loaded invoice's `due_date` and writes `status='overdue'` directly when the date is already past — so a freshly published past-due invoice lands on `overdue` immediately rather than waiting for the next cron sweep. The activity feed records `marked_as_overdue` in the same write.

---

## Email notifications

All transactional email goes through **Resend** via `src/lib/email/send.ts`. There are three email types, three triggers, and two recipient types.

> **Supabase auth emails (magic-link, signup confirmation, password reset) also route through Resend** via Supabase's custom SMTP setting (dashboard → Project Settings → Auth → SMTP Settings, pointing at `smtp.resend.com:465`). The custom SMTP **Sender** is set to `team@mail.satsend.me` — the same address `EMAIL_FROM` uses for transactional mail — so all SatSend mail (auth + invoicing) arrives with one consistent `From:` identity. Both auth email *and* transactional email depend on the Resend account / domain being healthy.

### Triggers, senders, recipients

| # | Email                 | Fires when…                                     | Callsite (server)                                        | Recipients                          |
|---|-----------------------|-------------------------------------------------|----------------------------------------------------------|-------------------------------------|
| 1 | **Invoice published** | Owner picks "Send now via email" from the publish/send menu | `src/app/(dashboard)/invoices/actions.ts` → `publishAndSendEmail` | Payer (`client_email`)              |
| 2 | **Payment detected**  | Status transitions → `payment_detected`         | `src/app/api/invoices/[id]/payment-status/route.ts` **or** `src/app/api/cron/payment-sweep/route.ts` | Invoice owner **and** payer (`client_email`) |
| 3 | **Payment confirmed** | Status transitions → `paid`                     | Same two callsites as above                              | Invoice owner **and** payer (`client_email`) |

Notes:
- The **payment-detected** and **payment-confirmed** emails are dispatched to **both** recipients per transition: the owner gets an "your client paid invoice X" framing, and the payer gets a "your payment to {sender} has been detected / confirmed" framing. Each transition fires two distinct Resend calls with role-specific templates (`payment-detected-owner.tsx` / `payment-detected-payer.tsx`, and the same split for confirmed).
- The owner email is resolved via `supabase.auth.admin.getUserById(invoice.user_id)`; the payer email is the invoice's `client_email`.
- If `client_email` is blank on an invoice (payer email is optional), every payer-side send is silently skipped — including the invoice-published email and both payment-status emails. The owner copy still goes out.
- Each email contains the invoice reference, a mempool.space link to the tx, and a link back to the right surface for that recipient (owner → dashboard view, payer → public invoice page).

### How duplicates are prevented

The fast-path API (triggered by the payer's mempool WebSocket) and the background cron can both observe the same state change. Without care, both would send the same email.

Deduplication works **at the DB level, not the email level**:

```sql
UPDATE invoices
  SET status = 'payment_detected', …
  WHERE id = :id
    AND status = :priorStatus   ← optimistic concurrency guard
```

Whichever path commits the status change first wins. The loser gets `PGRST116` (0 rows affected), short-circuits, and **never reaches the email dispatch**. So a given `pending → payment_detected` transition fires exactly one "Payment detected" email regardless of how many watchers saw the tx.

The same applies to `payment_detected → paid`.

Edge case: if the pre-mempool cron finds a **confirmed** tx directly (rare — the tx hit a block before any cron tick saw it unconfirmed), it transitions `pending → paid` in a single step and sends only the **confirmed** email. No "detected" email fires because no row ever held `payment_detected`.

### How email failure is handled

Every send goes through a `safeSend` wrapper (`src/lib/email/send.ts`) that:

1. Skips silently (with a `console.warn`) if `RESEND_API_KEY` is not set — so local development without Resend still works.
2. Catches any Resend error (non-2xx, network, rate-limit) and logs it to `console.error` instead of throwing.

**A broken email provider never blocks a publish or a payment transition.** The invoice state is the source of truth; email is best-effort delivery on top of it.

### Email event log

Every send attempt is recorded in the `email_events` table (migration `0010_email_events.sql`):

| Column            | Meaning                                                                  |
|-------------------|--------------------------------------------------------------------------|
| `email_type`      | `invoice_published` / `payment_detected` / `payment_confirmed`           |
| `recipient`       | The address Resend was asked to send to                                  |
| `status`          | `queued` → terminal `sent` / `failed` / `skipped_no_api_key`             |
| `resend_message_id` | Populated on `sent` from Resend's response — useful for cross-referencing the dashboard |
| `error_message`   | First 500 chars of the failure reason (Resend error or thrown exception) |
| `created_at` / `updated_at` | Timestamps for the row insert and its terminal-status update    |

`safeSend` (`src/lib/email/send.ts`) inserts a `queued` row before each Resend call, then flips the row to its terminal status when the send returns or throws. Both the insert and the update are best-effort: a failed DB write logs and continues so a broken `email_events` table never blocks a publish or a payment transition.

The table is owner-scoped via RLS (`auth.uid() = user_id`) and surfaces on `/invoices/[id]` as the **Email activity** card so the owner can answer *"did the payer get the link?"* or *"why didn't I get a confirmation email?"* without leaving the app.

### What is *still not* tracked

The `email_events` row records what happened at our end (we asked Resend, Resend acknowledged or rejected). It does not yet record what happened on the recipient's end:

- **Delivered / bounced / complained / opened / clicked** — these are emitted by Resend as webhooks. A future version would expose `POST /api/webhooks/resend` and update rows by `resend_message_id`. For now, that detail lives in the Resend dashboard.
- There is no retry queue: `failed` is terminal until someone manually triggers a resend.

---

## Schema columns that drive this

Migration `0008_background_payment_schedule.sql`:

- `next_check_at TIMESTAMPTZ` — when the cron should next process this row. `NULL` = not in the rotation.
- `mempool_seen_at TIMESTAMPTZ` — stamped the first time a paying tx is observed. Drives the pre-/post-mempool cadence branch.
- `stage_attempt INT DEFAULT 0` — counter the scheduler uses to index into the delay tables.

Partial index `invoices_next_check_at_idx` on `next_check_at WHERE next_check_at IS NOT NULL` keeps the cron's `SELECT … WHERE next_check_at <= now()` fast.
