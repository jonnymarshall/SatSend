# SatSend — Feature Roadmap

> **This file is the single source of truth for what to build next and in what
> order.** Work top to bottom through the first ⏳ item. The immediate next work
> is the **Security & Hardening train (v1.4.19-H … v1.4.28-H)** below, which comes
> from the 2026-07 master architecture audit and takes priority over the older
> feature queue. Step-by-step detail for each hardening item is in **Appendix A**
> and the reasoning and full findings behind every item are in **Appendix B**,
> both at the end of this file. **This file is the only roadmap document** — the
> former `HARDENING-ROADMAP.md` and `ARCHITECTURE-AUDIT-2026-07.md` are folded in
> below. Open Appendix A when you start a specific hardening item, for its exact
> steps.

## Status Legend

| Emoji | Meaning |
|-------|---------|
| ✅ | Complete (merged) |
| 🔄 | In progress |
| ⏳ | Queued — not started |
| 🔴 | Queued — security/correctness blocker (do before feature work) |
| 🚫 | Deferred |

---

## v1 — MVP (Core BTC Invoicing)

> Goal: A working product a freelancer can use today. Create an invoice, share it, get paid in BTC.

---

### ✅ v1.0 — Project Foundation

**Branch:** `v1.0/foundation`

- [x] Next.js App Router project with TypeScript
- [x] Tailwind CSS + shadcn/ui dark theme configured (bg `#0A0A0A`, surface `#181818`, accent `#DE3C4B`)
- [x] Supabase project linked; `invoices` table + enums + RLS policies
- [x] Magic link auth via Supabase Auth
- [x] Auth proxy (proxy.ts, Next.js 16) protecting `/dashboard` and related routes
- [x] Basic layout: navbar, authenticated shell

**Done when:** A user can sign in via magic link and land on an empty dashboard.

---

### ✅ v1.1 — Invoice CRUD + Dashboard

**Branch:** `v1.1/invoice-crud`

- [x] Invoice creation form: client name, client email, line items, optional tax, due date, BTC address
- [x] BTC address uniqueness validation (no reuse across non-draft invoices)
- [x] Save as draft
- [x] Publish invoice: generates 8-char alphanumeric access code + shareable link
- [x] Dashboard: list all invoices with status badge (draft, pending, payment_detected, paid, overdue)
- [x] Delete draft invoice
- [x] Mark invoice as overdue (manual)

**Done when:** A freelancer can create, publish, and manage invoices from their dashboard.

---

### ✅ v1.1.1 — Invoice Form Improvements

**Branch:** `fix/invoice-form-improvements`

**Schema changes**
- [x] Add `invoice_number` (text, nullable) to invoices table
- [x] Replace `tax_fiat` with `tax_percent` (numeric, default 0) — store as %, compute fiat at save time
- [x] Add sender fields: `your_name`, `your_email`, `your_company`, `your_address`, `your_tax_id` (all text, nullable)
- [x] Add client fields: `client_company`, `client_address`, `client_tax_id` (all text, nullable)
- [x] Add `accepts_bitcoin` (boolean, default false)
- [x] Change `access_code` to be nullable and user-set (no auto-generation)
- [x] Add `btc_address` nullable when `accepts_bitcoin` is false

**Form UX**
- [x] Split form header: "YOU" (left) / "CLIENT" (right) with full sender + client fields
- [x] Invoice number field (freeform text, max 50 chars)
- [x] Tax field: percent input (%), compute fiat on save
- [x] Due date: shadcn date picker + "No due date" toggle
- [x] Quantity and unit price: freeform (empty = 0 on submit), max qty 100,000 / max unit price 1,000,000,000, 2 decimal places, no spinner arrows
- [x] "Accept Bitcoin" toggle — shows BTC address field only when enabled
- [x] Access code: user-set text field OR "No access code" toggle (no auto-generation)
- [x] Remove red asterisks from all fields
- [x] Email validation (valid format if entered, not required)

**Invoice detail page**
- [x] Mark as paid button (manual, for non-BTC or already-confirmed payments)
- [x] Edit draft button → pre-populated edit form (same as new invoice form)
- [x] Fix share link: show full URL (`http://...`), add copy button with copied feedback
- [x] Fix route: `/invoice/[id]` public route stub (placeholder until v1.2)

**Done when:** All form feedback addressed, draft editing works, share link copies correctly.

---

### ✅ v1.1.2 — Invoice Form Polish

**Branch:** `fix/invoice-form-improvements` (continued)

- [x] Form too left-aligned — remove `max-w-2xl` constraint, let dashboard width govern
- [x] Add visual gap/separator between YOU and CLIENT columns
- [x] Line items: rewrite with flex rows (grid arbitrary values unreliable), keep no-spinners + allow empty
- [x] Tax % input: replace absolute-positioned `%` with inline flex suffix; remove spinners
- [x] Date picker: widens automatically once form width is fixed
- [x] Access code: remove checkbox, single optional input labelled "Access code (Optional)"
- [x] Remove client name as a required field — all client fields optional

**Done when:** Form looks balanced, line items are horizontal, tax field is clean, access code is simplified.

---

### ✅ v1.1.3 — Invoice Form Layout & Validation Fixes

**Branch:** `fix/invoice-form-improvements` (continued)

**Layout**
- [x] Fix YOU/CLIENT sections — columns side-by-side with centred divider and clear gap (inline styles to work around Tailwind v4 gap/padding generation bug)
- [x] Line items: column headers (Description, Qty, Unit price) in same div as their inputs — mirrors Field pattern, labels only on first row, subsequent rows align underneath
- [x] Line items: use inline `gap` style so column widths are consistent across all rows
- [x] Dynamic page title — reverted; title stays as static "New Invoice" / "Edit Invoice"
- [x] Remove Tax % suffix element — label now reads "Tax (%)" instead

**Validation & input behaviour**
- [x] Email validation: only validates format if an email is entered; blank is allowed for both sender and client
- [x] Allow "0" as a valid quantity or unit price (tracked as raw string; zero no longer collapses to empty display)
- [x] Invoice number: max 50 characters enforced via `maxLength` attribute and validation
- [x] Qty field: no placeholder after deletion — field is blank when empty, no greyed "1" re-appearing
- [x] Qty / Unit price inputs changed to `type="text" inputMode="decimal"` — eliminates spinners, scroll-wheel changes, and arrow-key increments entirely
- [x] Tax input likewise changed to `type="text" inputMode="decimal"`
- [x] Fix `client_email` / `your_email` NOT NULL constraint — send empty string instead of null when blank
- [x] New line items added via "+ Add line item" now prefill qty with "1" (matching the initial row)

**Done when:** YOU and CLIENT sit side by side with a centre divider; column headers align with their inputs; all input behaviour matches spec above.

---

### ✅ v1.1.4 — Invoice UX Polish

**Branch:** `fix/invoice-form-improvements` (continued)

**Routing**
- [x] `/invoices` route shows the invoice list (same as `/dashboard`); `/dashboard` redirects to `/invoices`

**Invoice form**
- [x] Remove `heading-invoice-title` element from the invoice form — title lives on the page, not inside the form component
- [x] Close vertical space between field rows within YOU and CLIENT sections
- [x] Scroll page to first failed validation field when a form submission fails validation
- [x] Stop `client_name` defaulting to "Unnamed" when left blank — allow empty
- [x] Cancel button at the bottom of the edit invoice form; if the form is dirty, show a confirmation modal before discarding changes

**Invoice detail page**
- [x] Fix centering — detail page content is left-aligned within the wide layout container; add `mx-auto`
- [x] Replace client name in the large header with the invoice number; remove the smaller inline invoice number beside it
- [x] Add "Mark as unpaid" action for paid invoices (reverts status to pending)

**Done when:** All items above are checked off.

---

### ✅ v1.1.5 — Form Validation, Nav & Date Picker

**Branch:** `fix/invoice-form-improvements` (continued)

**Routing & nav**
- [x] Navbar "Paybitty" logo text links to home (`/invoices`)

**Form validation hardening**
- [x] Qty field: enforce max 100,000 and max 2 decimal places (validate on submit, not on keystroke)
- [x] Unit price field: enforce max 1,000,000,000 and max 2 decimal places (validate on submit)

**Date picker**
- [x] Replace current narrow date picker with the correctly-sized shadcn date picker matching the component docs (proper popover width, calendar styling)

**ID coverage**
- [x] Create a reusable `add-ids` skill that audits the UI and adds appropriately named `id` attributes to all key elements
- [x] Run the skill across all pages and components so every interactive and structural element has a stable ID

**Done when:** Nav logo navigates home, validation rejects out-of-range qty/price, date picker matches shadcn docs, all key elements have IDs.

---

### ✅ v1.2 — Client Payment View + BTC QR Code

**Branch:** `v1.2/client-payment-view`

> Note: `/invoice/[id]` currently shows a "Client payment view coming soon" stub. This branch replaces it with the full implementation.

- [x] Public route `/invoice/[id]` with access code gate
- [x] BTC price fetching API: `GET /api/btc-price?currency=USD` (Coinbase primary, CoinGecko fallback, ~60s server-side cache)
- [x] BTC amount computed from live price at view time
- [x] BIP21 QR code generated (`bitcoin:<address>?amount=<btc>&label=<label>`)
- [x] Client view: invoice details, fiat total, BTC amount, QR code

**Also fixed on this branch**
- [x] BTC address conflict error: shows inline below field (not top of form), scrolls to field, friendly message naming the conflicting invoice
- [x] BTC conflict check covers all non-draft statuses (was only checking `pending`; DB index covers all)
- [x] Centralised `parseServerError()` utility — error message wording lives in one place
- [x] Conflict error falls back to short invoice ID (`…xxxxxxxx`) when conflicting invoice has no number

**Done when:** A client can open a link, enter an access code, see the invoice, and scan a QR code to pay.

---

### ✅ v1.3 — Payment Detection

**Branch:** `v1.3/payment-detection`

- [x] mempool.space WebSocket connection opened client-side on the payment view page
- [x] 0-conf event: update invoice status to `payment_detected`
- [x] 1-conf event: update invoice status to `paid`
- [x] Fallback: exponential backoff polling (30s start, doubles, caps ~10min)
- [x] WebSocket closed once invoice reaches `paid`
- [x] Real-time status UI update on client payment page
- [x] `btc_txid` saved when payment is detected or confirmed; displayed in both user and client views as a link to mempool.space
- [x] BTC address validation — checksum-verified (bech32, bech32m, base58check) on both client form and server action; invalid addresses blocked at publish time

> **Deferred to v1.4:** On-login sweep of all `pending` / `payment_detected` invoices — detected payments are caught when any relevant invoice page is viewed, which covers the common case. A background sweep at login will be added in v1.4 alongside email notifications (same session).

**Done when:** Payment detection works end-to-end with live and fallback paths; invalid BTC addresses are rejected at publish time.

---

### ✅ v1.3.1 — Invoice View & List Date Polish

**Branch:** `v1.3.1/invoice-date-polish`

- [x] Invoice detail page (user view): add "Date Sent" (created/published date) and "Date Due" — currently shows no date information
- [x] Client payment view: already shows "Due" date — add "Date Sent" alongside it for full context
- [x] `/invoices` list: replace creation date with due date; label it "Due \<date\>" to avoid ambiguity (invoices with no due date show a dash or nothing)

**Done when:** Both views clearly surface sent and due dates; the invoice list shows due date with unambiguous label.

---

### ✅ v1.3.2 — Invoice List Management

**Branch:** `v1.3.2/invoice-list-management`

- [x] Multi-select checkboxes on the `/invoices` list
- [x] Bulk action dropdown appears when one or more invoices are selected: Delete, Archive, Mark as Paid
- [x] Archive status: add `archived` to invoice status enum; archived invoices hidden from main list by default (consider a toggle to show them)
- [x] Bulk delete: confirm before executing; only draft invoices deletable in bulk (or confirm for non-draft)
- [x] Bulk mark as paid: applies to selected non-paid invoices

**Done when:** User can select multiple invoices and apply bulk actions from a single dropdown.

---

### ✅ v1.3.3 — Payment Sent Button & Reveal Gate

**Branch:** `v1.3.3/payment-sent-button`

- [x] "Pay now in Bitcoin" reveal button — QR and address hidden until the payer clicks through, so they review the invoice first. Auto-reveals for already-detected/paid invoices.
- [x] "Mark as Payment Sent" button opens a dialog that actively polls mempool.space for 60 seconds on a front-loaded tiered schedule (5x2s + 5x3s + 3x5s + 2x10s = 15 polls)
- [x] Dialog states: polling (progress bar + "Cancel" with helper text), detected ("Your payment has been detected" + OK), timed-out (with mempool.space link)
- [x] Detected dialog auto-pops on status transition pending/overdue → payment_detected/paid — even if the payer never clicked "Mark as Payment Sent"
- [x] Progress bar animates to 100% for ~400ms on detection before flipping to the detected view (visual beat for confirmation)
- [x] Background watcher's fallback-polling first-delay cut from 30s to 10s; WebSocket errors now logged to the browser console
- [x] `/invoices` list and `/invoices/[id]` detail page live-update via Supabase Realtime — freelancer's row/page flips alongside the payer's confirmation, no manual refresh required
- [x] `REPLICA IDENTITY FULL` set on `public.invoices` (migration `0006`) so UPDATE events carry all column values for reliable Realtime delivery
- [x] Realtime hook explicitly sets `supabase.realtime.setAuth(access_token)` before subscribing to avoid RLS silently dropping events, and falls back to `router.refresh()` on `visibilitychange` as a safety net

**Done when:** A payer has an explicit action that tells them the system is actively checking, with a clear resolution (detected or not-yet-detected with a mempool.space link) within 60 seconds, AND a clear "Your payment has been detected" confirmation appears even if they never clicked the button.

---

### ✅ v1.3.4 — Invoice Duplication

**Branch:** `v1.3.4/invoice-duplication`

- [x] `Duplicate` action on the `/invoices` per-row dropdown (placeholder 🚩 shipped in v1.3.2)
- [x] Server action `duplicateInvoice(id)` — creates a new draft invoice by copying all fields from the source except: `id`, `status` (→ draft), `btc_address` (cleared — addresses can't be reused), `btc_txid` (cleared), `created_at` / `updated_at`. `access_code` persists.
- [x] `invoice_number` behavior: append " (copy)" if source has a number; leave null otherwise
- [x] After duplication, redirect the user to `/invoices/[new-id]/edit`

**Done when:** User can duplicate any invoice into a new draft with a single click.

---

### ✅ v1.3.5 — Dashboard Invoice UX Polish

**Branch:** `v1.3.5/dashboard-invoice-polish`

Small follow-up polish on the owner's dashboard views — the list and the single-invoice detail page. All items are self-contained UI improvements, no schema changes.

**`/invoices` list**
- [x] `Unarchive` action on the per-row dropdown for rows with status `archived` (mirrors the existing `Archive` action, reverses status back to its pre-archive value or a sensible default like `pending`)
- [x] `Clear Selected` button appears above the data table (next to or within the toolbar row) whenever one or more rows are selected; clicking it clears the row-selection state without affecting filters or other UI state

**`/invoices/[id]` dashboard detail page**
- [x] Mirror the `/invoices` per-row dropdown actions as buttons at the bottom of the detail view (status-aware, same conditional logic). Example: Edit (draft only), View public invoice / Copy public link (non-draft), Mark as sent (draft), Mark as paid, Archive / Unarchive, Duplicate, Delete. The existing dropdown stays as-is on the list; this is a second surface for the same actions on the detail page where there is room for explicit buttons.

**Done when:** Archived rows can be restored without leaving the list, selection can be cleared with one click, and every action available from the dropdown is also reachable as an explicit button from the single-invoice view.

---

### ✅ v1.3.6 — Form & Client View Polish

**Branch:** `v1.3.6/form-and-client-view-polish`

Two small, independent input/display-quality fixes bundled because they each touch a single field or component.

**`/invoices/new` form**
- 🚫 ~~Suppress password-manager browser-extension icons on Invoice number / Name / Email / Company fields.~~ _Won't fix: LastPass ignores the standard opt-out signals (`data-lpignore`, `autoComplete="off"`, `data-form-type="other"`) whenever a field's label or id matches one of its autofill categories (name/email/company/number). Attributes alone were shipped and verified in the DOM but LastPass injected the icon anyway. The only reliable workarounds (`type="search"` on identity fields, or swapping `type="email"` for `type="text"`) break HTML semantics and native validation — not worth the tradeoff for one extension's heuristic._

**`/invoice/[id]` public payment view**
- [x] Make the BTC amount copyable — click/tap to copy, with the same "copied" feedback used on the `/invoices/[id]` share-link copy button (`src/components/copy-button.tsx`)
- [x] Make the BTC address copyable with the same pattern

**Done when:** Password-manager icons no longer clutter the New Invoice form on fields where autofill is nonsense, and the payer can copy the BTC amount and address with a single click from the public view.

---

### ✅ v1.4 — PDF Generation + Email Notifications

**Branch:** `v1.4/pdf-and-email`

- [x] On login: sweep all `pending` / `payment_detected` invoices for the user to catch missed events (deferred from v1.3)
- [x] Resend + React Email configured
- [x] Email: invoice link + access code sent to client on publish
- [x] Email: payment detected notification to creator (0-conf)
- [x] Email: payment confirmed notification to creator (1+ conf)
- [x] PDF generation with `@react-pdf/renderer` (server-side)
- [x] PDF download available from invoice detail view
- [x] Log out button in the dashboard nav (right of the user email) — needed for testing sign-in with a different account during email deliverability checks

**Done when:** All transactional emails send correctly and PDFs are downloadable.

---

### ✅ v1.4.1 — Background Payment Polling (replaces login sweep)

**Branch:** `v1.4.1/background-payment-polling`

**Context for a fresh session:** v1.4 shipped two payment-detection paths: (a) a client-side mempool WebSocket watcher on `/invoice/[id]` that catches transitions in real time while the payer is on the page, and (b) a login-time "sweep" (`src/components/login-sweep-trigger.tsx` + `src/app/(dashboard)/sweep-action.ts`) that catches missed transitions when the owner next opens the dashboard. Both leave a gap: if the payer closes the page *and* the owner doesn't log in, nothing runs. This version replaces the login sweep with a **Vercel Cron** that polls mempool.space on a per-invoice schedule, so detection is fully background — no user presence required on either side.

**Polling schedule (user-confirmed):**

- **Pre-mempool (status = `pending`, nothing broadcast yet):** 1m, 5m, 10m, 30m after publish. If still not seen after ~46 min, background polling stops for that invoice. Client-side watcher still works if the payer returns to the page.
- **Post-mempool (status = `payment_detected`, tx seen but unconfirmed):** 10m × 3, then 1h × 6, then 4h × 12, then 8h × 24. After ~11 days unconfirmed, stop.

**Login sweep is removed entirely** — the background cron becomes the single source of truth.

---

#### Schema — new migration `supabase/migrations/0008_background_payment_schedule.sql`

Add three columns to `invoices`:

- `next_check_at TIMESTAMPTZ` (nullable) — when the cron should next process this row. `NULL` = no polling (draft, paid, archived, or exhausted).
- `mempool_seen_at TIMESTAMPTZ` (nullable) — when the tx was first seen in mempool. Drives the post-mempool cadence.
- `stage_attempt INT NOT NULL DEFAULT 0` — counter within the current stage. Interval = fn(mempool_seen_at IS NULL, stage_attempt).

Partial index on `next_check_at WHERE next_check_at IS NOT NULL` for fast cron lookups.

Backfill: existing `pending`/`payment_detected` rows get `next_check_at = now() + interval '1 minute'` so they pick up on first cron run.

#### New pure scheduling function — `src/lib/invoices/payment-schedule.ts`

```ts
interface ScheduleInput {
  status: "pending" | "payment_detected";
  btc_address: string;
  mempool_seen_at: string | null;
  stage_attempt: number;
}

interface ScheduleDecision {
  newStatus: "pending" | "payment_detected" | "paid";
  newMempoolSeenAt: string | null;
  newStageAttempt: number;
  newNextCheckAt: string | null; // null = stop polling
  detectedTxid: string | null;   // non-null if status changed this tick
}

function decidePaymentSchedule(
  input: ScheduleInput,
  txs: MempoolTx[],
  now: Date
): ScheduleDecision
```

Pure function, no I/O. Replaces the core decision logic currently inside `sweepUserInvoices`. Fully unit-tested.

Delay table (hardcoded, easy to tweak):

```ts
const PRE_MEMPOOL_DELAYS_MS = [60_000, 300_000, 600_000, 1_800_000]; // 1m, 5m, 10m, 30m
const POST_MEMPOOL_STAGES = [
  { count: 3,  intervalMs: 10 * 60_000 },
  { count: 6,  intervalMs: 60 * 60_000 },
  { count: 12, intervalMs: 4 * 60 * 60_000 },
  { count: 24, intervalMs: 8 * 60 * 60_000 },
];
```

#### New cron endpoint — `src/app/api/cron/payment-sweep/route.ts`

Behavior:
1. Require `Authorization: Bearer $CRON_SECRET` — 401 otherwise. Vercel Cron attaches this header automatically.
2. Fetch up to 50 invoices where `next_check_at <= now()` AND `status IN ('pending','payment_detected')`.
3. For each: `fetchAddressTxs(btc_address)` (existing helper in `src/lib/mempool.ts`), pass to `decidePaymentSchedule`, apply update with optimistic concurrency (`.eq("status", current.status)`).
4. If status transitioned: dispatch via existing `sendPaymentDetectedEmail` / `sendPaymentConfirmedEmail` (resolve owner email via `supabase.auth.admin.getUserById`, same pattern as `src/app/api/invoices/[id]/payment-status/route.ts`).
5. Return JSON `{ processed, transitions, errors }` for Vercel Cron logs.

Batch cap (50) protects against mempool.space rate limits (~10/s).

#### Vercel cron config — new `vercel.json` at repo root

```json
{
  "crons": [
    { "path": "/api/cron/payment-sweep", "schedule": "* * * * *" }
  ]
}
```

Every minute. Vercel's current policy (2025) supports per-minute cron on Hobby with up to 2 crons.

> **Correction (v1.4.28-H / S3).** That policy did not hold: Hobby-tier deploys reject sub-daily schedules, so this was downgraded to a daily placeholder and the real cadence moved to an external scheduler (`.github/workflows/payment-sweep.yml`, every ~5 min). See Appendix A → S3.

#### Payment-status route — consolidate shared logic

`src/app/api/invoices/[id]/payment-status/route.ts` currently has near-duplicate transition logic. After the route's existing txid validation, replace its ad-hoc status-update block with a call into a thin wrapper around `decidePaymentSchedule` (or a helper that accepts a known txid rather than raw mempool txs). The route still exists — it's the fast path when the client-side watcher fires — but it now shares one schedule / one state-update shape with the cron.

#### Files to DELETE (login sweep removal)

- `src/components/login-sweep-trigger.tsx`
- `src/app/(dashboard)/sweep-action.ts`
- `src/lib/invoices/sweep.ts` + `sweep.test.ts` (logic moves to `payment-schedule.ts`)

#### Files to EDIT

- `src/app/(dashboard)/layout.tsx` — remove `<LoginSweepTrigger />` and its import.
- `src/app/(dashboard)/invoices/actions.ts` — in `publishInvoice`, after setting status to `pending`, also set `next_check_at = now() + 1 minute`, `stage_attempt = 0`, `mempool_seen_at = null`.
- `src/app/api/invoices/[id]/payment-status/route.ts` — consolidate per above.
- `development/ROADMAP.md` — flip this section ⏳ → ✅ when done; add `CRON_SECRET` to the pre-deployment checklist.
- `CHANGELOG.md` — add v1.4.1 entry.

#### Tests

New:
- `src/lib/invoices/payment-schedule.test.ts` — high coverage; this is the core logic:
  - Pre-mempool attempt 0 → next interval 5m.
  - Pre-mempool attempt 3 (final) with no tx → `next_check_at = null` (stop).
  - Pre-mempool attempt with unconfirmed tx → transition to `payment_detected`, `mempool_seen_at` set, `stage_attempt = 0`, `next_check_at = +10m`.
  - Pre-mempool attempt with confirmed tx → transition to `paid`, `next_check_at = null`.
  - Post-mempool attempt 2 (end of 10m stage) → next interval 1h.
  - Post-mempool attempt 8 (end of 1h stage) → next interval 4h.
  - Post-mempool attempt 44 (final) with still-unconfirmed tx → `next_check_at = null` (stop).
  - Post-mempool attempt with confirmed tx → transition to `paid`, `next_check_at = null`.
- `src/app/api/cron/payment-sweep.test.ts` (route-level):
  - 401 when bearer missing / wrong.
  - Correct scope: `.eq("status", "pending"/"payment_detected")`, `.lte("next_check_at", now())`, `.limit(50)`.
  - Emails dispatched exactly once per transition (mock `@/lib/email/send` same way `payment-status.test.ts` does).

Update:
- `src/app/(dashboard)/invoices/actions.test.ts` — `publishInvoice` tests should assert `next_check_at`, `stage_attempt`, `mempool_seen_at` are written.

Delete:
- `src/lib/invoices/sweep.test.ts` (the sweep it tests is being removed).

All remaining tests should continue to pass. Typecheck + lint clean.

#### Manual-test affordance for dev

In dev, Vercel Cron doesn't fire. Curl the endpoint with the secret:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/payment-sweep
```

Document this at the top of the route file.

#### Pre-deployment additions

Add to the "Pre-deployment Checklist" section at the bottom of this roadmap:
- `CRON_SECRET` — required by the cron endpoint. Vercel generates this when you configure the cron; mirror it into `.env.local` for dev curl.

**Done when:** A testnet invoice, published and then immediately abandoned (payer closes the tab), still transitions to `payment_detected` and then `paid` on the correct mempool events — with the creator receiving both emails — without anyone logging in.

> **Followup validation (not yet performed):** end-to-end tested on testnet4 only. A mainnet dry-run with a real BTC address is still outstanding — set `NEXT_PUBLIC_BTC_NETWORK=mainnet` in `.env`, restart the dev server, publish an invoice with a real receive address, and confirm the same `pending → payment_detected → paid` flow runs through the cron without code changes. An earlier attempt against a mainnet address failed silently, most likely because the network env var was still pointing at testnet4.

---

### ✅ v1.4.2 — Public Payer Page Live Updates

**Branch:** `v1.4.2/public-invoice-realtime`

**Context:** In v1.4.1, the background cron (and the existing fast-path `/api/invoices/[id]/payment-status` route) can both transition an invoice's status without the payer's page knowing. The public `/invoice/[id]` page currently has no Supabase Realtime subscription — it only updates via its own mempool.space WebSocket (while the tab is open) or via server-render on first load. If the cron flips `pending → payment_detected` while the payer is looking at the page, the badge won't move until they refresh.

**Scope**
- [x] Add a Supabase Realtime subscription to `src/app/invoice/[id]/invoice-payment-view.tsx` (or a small hook like `use-public-invoice-realtime.ts`) that listens for UPDATEs on the `invoices` table filtered to the specific invoice id, and applies them to local state.
- [x] Subscribe with the anon key (not the user session — payer is unauthenticated on this page). Confirm RLS allows a SELECT on the row scoped by id + access_code, or add a permissive SELECT policy specifically for Realtime if needed. `REPLICA IDENTITY FULL` is already set (migration 0006) so UPDATE events carry full rows.
- [x] Keep the existing mempool.space WebSocket watcher — it's still the fastest path when the payer is on the page. Realtime is the fallback for cron-driven transitions.
- [x] Add `visibilitychange` → `router.refresh()` safety net (same pattern as the dashboard hook).
- [x] Unit-test the new hook the same way `use-invoice-realtime.test.ts` tests the dashboard one.

**Done when:** With the payer's page open and no mempool-side connection activity, running the cron (or calling the fast-path API from a different client) immediately flips the status badge on the payer's page without a refresh.

**Also update the README when this ships:**
- [x] In `README.md` → "Payment detection architecture" → summary table, remove the callout under the table that says path (C) changes won't reach the payer without a refresh. That disclaimer exists specifically because of the v1.4.1 gap this branch closes.
- [x] Extend the "(D) Owner live updates" section (or add a new "(E) Payer live updates" section) documenting that the public `/invoice/[id]` page now subscribes to Supabase Realtime too, including the anon-key / RLS note.

---

### ✅ v1.4.3 — Email Event Log (DB-backed)

**Branch:** `v1.4.3/email-events-log`

**Context:** v1.4 added three transactional emails (invoice published, payment detected, payment confirmed), and v1.4.1 added a second callsite for the payment emails (the background cron). Today there is **no persistent record** that any of these were sent — evidence only lives in Resend's dashboard and transient runtime logs. If a payer reports never receiving an invoice link, or an owner claims they never got a payment-confirmed email, there is no in-app way to answer *"was it sent, when, and did it succeed?"* This branch closes that gap.

**Checklist:**
- [x] Migration `0010_email_events.sql` (renumbered from 0009 — that slot was taken by v1.4.2's anon-select policy): enums, table, indexes, RLS, owner-read policy
- [x] `src/lib/email/send.test.ts` covers queued→sent, skipped_no_api_key, failed-with-error-message, and DB-write-failure-doesn't-throw
- [x] `safeSend` refactored to take `EmailContext { invoiceId, userId, type, recipient }` and write `email_events`
- [x] All three `sendXxxEmail` functions build and pass `EmailContext`
- [x] `publishInvoice` passes `invoice.user_id`; existing test asserts `userId: "user-1"`
- [x] `payment-status` route passes `invoice.user_id`; existing test asserts `userId: "owner-1"`
- [x] `payment-sweep` cron passes `inv.user_id`; existing test asserts `userId: "owner-1"`
- [x] **Email Activity** card on `/invoices/[id]` (server component fetching `email_events` for the invoice)
- [x] README "Email event log" + "What is *still not* tracked" sections rewritten
- [x] CHANGELOG v1.4.3 entry
- [x] Manual test guide: `manual-tests/v1.4.3-email-events-log.md` (6 tests + 90s smoke)
- [x] ROADMAP flipped to ✅

**Notes / deviations from the original spec:**
- Migration filename is `0010_email_events.sql`, not `0009_email_events.sql` (the `0009` slot was taken by v1.4.2's anon-select policy).
- Failed-row error rendering: spec said *"error message on hover"* (native `title` tooltip). Implementation surfaces the error **inline in red text below the row** instead — discoverable without hover, accessible to keyboard and screen-reader users.
- Realtime auto-refresh of the activity card is **not wired up** (deferred). The existing v1.3.3 invoice realtime hook only refetches the invoice row, not its email events. Loading the page or any normal navigation re-fetches them server-side.

---

#### Schema — new migration `supabase/migrations/0009_email_events.sql`

```sql
create type email_type as enum (
  'invoice_published',
  'payment_detected',
  'payment_confirmed'
);

create type email_event_status as enum (
  'queued',
  'sent',
  'failed',
  'skipped_no_api_key'
);

create table email_events (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references invoices(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  email_type      email_type not null,
  recipient       text not null,
  status          email_event_status not null default 'queued',
  resend_message_id text,              -- populated from Resend's response on success
  error_message   text,                -- populated on 'failed'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index email_events_invoice_id_idx on email_events (invoice_id, created_at desc);
create index email_events_user_id_idx    on email_events (user_id, created_at desc);

alter table email_events enable row level security;

create policy "owner can read own email events"
  on email_events for select
  using (auth.uid() = user_id);
-- Inserts/updates only happen server-side via the service role key; no anon insert policy.
```

`user_id` is denormalised from the invoice row so the RLS policy is a simple `auth.uid() = user_id` check rather than a join.

---

#### `safeSend` refactor — `src/lib/email/send.ts`

Current signature wraps a closure; new signature passes context so the wrapper can write to `email_events`:

```ts
interface EmailContext {
  invoiceId: string;
  userId: string;
  type: EmailType;
  recipient: string;
}

async function safeSend(ctx: EmailContext, send: () => Promise<{ id: string }>): Promise<void> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("email_events")
    .insert({
      invoice_id: ctx.invoiceId,
      user_id: ctx.userId,
      email_type: ctx.type,
      recipient: ctx.recipient,
      status: "queued",
    })
    .select("id")
    .single();

  if (!getResend()) {
    await admin.from("email_events").update({ status: "skipped_no_api_key" }).eq("id", row!.id);
    console.warn(`[email] skipping ${ctx.type} — RESEND_API_KEY not set`);
    return;
  }

  try {
    const { id: resendId } = await send();
    await admin.from("email_events").update({
      status: "sent",
      resend_message_id: resendId,
      updated_at: new Date().toISOString(),
    }).eq("id", row!.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin.from("email_events").update({
      status: "failed",
      error_message: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("id", row!.id);
    console.error(`[email] ${ctx.type} failed`, err);
  }
}
```

- All three `sendXxxEmail` functions in `src/lib/email/send.ts` are updated to build an `EmailContext` and pass it through.
- `publishInvoice` and both payment callsites pass `invoice.user_id` (for `invoice_published` this is the owner's id, even though the recipient is the payer — the log is owner-scoped for RLS).
- The DB write is best-effort (same philosophy as the email itself): if the admin client fails, log and continue. Never block the parent flow.

---

#### Minimal UI — invoice detail page

On `src/app/(dashboard)/invoices/[id]/page.tsx`, add a small collapsible **"Email activity"** card below the existing actions:

- Lists every `email_events` row for the invoice, most recent first.
- Each row renders: type (human-readable), recipient, status badge (sent / queued / failed / skipped), timestamp, error message on hover if `failed`.
- No pagination — invoices will have at most a handful of rows.

Server component, fetched inline — no client-side polling needed. If a row is still `queued` when the page loads, the Realtime subscription from v1.3.3 already fires `router.refresh()` on invoice row changes; we can extend it to also refresh on `email_events` inserts/updates, or simply leave a "click to refresh" affordance.

---

#### Tests

Update:
- `src/app/(dashboard)/invoices/actions.test.ts` — assert an `email_events` row is inserted with `type='invoice_published'` and eventually marked `sent` on a successful publish.
- `src/app/api/invoices/payment-status.test.ts` — assert event rows for `payment_detected` / `payment_confirmed` transitions.
- `src/app/api/cron/payment-sweep.test.ts` — same assertions for cron-driven transitions.

New:
- `src/lib/email/send.test.ts` — unit tests for `safeSend`: queued-then-sent happy path; skipped when no API key; failed with error message captured; DB write failure doesn't throw.

---

#### Files to EDIT

- `src/lib/email/send.ts` — `safeSend` refactor + context plumbing.
- `src/app/(dashboard)/invoices/actions.ts` — pass `user_id` to `sendInvoicePublishedEmail`.
- `src/app/api/invoices/[id]/payment-status/route.ts` — pass `user_id` to the payment email calls.
- `src/app/api/cron/payment-sweep/route.ts` — same.
- `src/app/(dashboard)/invoices/[id]/page.tsx` — render the email activity card.
- `README.md` — rewrite the **"What is *not* tracked"** sub-section to describe the new table; mention the Resend dashboard as the complementary source for webhook-level data (bounces, complaints) that is not captured yet.
- `development/ROADMAP.md` — flip this section ⏳ → ✅.
- `CHANGELOG.md` — v1.4.3 entry.

---

#### Out of scope (deferred)

- **Resend webhooks** (delivered / bounced / complained events). Would go into a follow-up (e.g. v1.4.4) as a `POST /api/webhooks/resend` endpoint that updates `email_events` rows by `resend_message_id`. Useful but not required to answer the original *"did it send?"* question.
- **Admin-wide email console.** Per-invoice is enough for v1.4.3. A tenant-wide deliverability view is a v2 concern.
- **Retry of failed sends.** No queue infra yet. Leave `status='failed'` as terminal; manual resend is an explicit action.

**Done when:** every email the system sends (or skips) has a corresponding `email_events` row, visible from the invoice detail page to the owner, with status and error messaging surfaced. The README accurately describes the log.

---

### ✅ v1.4.4 — Email Recipient Expansion + Sender Identity

**Branch:** `v1.4.4/email-recipient-and-sender`

**Context:** Today the payment-detected / payment-confirmed emails go to the invoice owner only; the payer never hears back by email after paying. The payer only sees confirmation on the public invoice page they paid through, which is gone the moment they close the tab. Separately, the Resend transactional sender (`EMAIL_FROM`) and the Supabase auth SMTP sender are not aligned — users get magic links from one `From:` and invoice emails from another. Both go out as part of this branch.

**Scope**
- [x] `sendPaymentDetectedEmail` and `sendPaymentConfirmedEmail` — send to **both** the owner and the payer (`client_email`). Two separate Resend calls per transition (keeps per-recipient personalisation simple; `safeSend` already handles failures per-call). Skip the payer-side send if `client_email` is blank, same rule as `sendInvoicePublishedEmail`.
- [x] Consider distinct email copy per recipient — the owner wants "Your client paid invoice X"; the payer wants "Your payment to Y has been detected / confirmed". Two template variants or one template parameterised by role. Prefer template variants for clarity.
- [x] Update `src/lib/email/templates/payment-detected.tsx` and `payment-confirmed.tsx` accordingly — or split into `-owner`/`-payer` files.
- [x] Update all three email callsites (`publishInvoice`, fast-path payment-status route, cron sweep) to dispatch both recipients where applicable.
- [x] Unify sender identity: set `EMAIL_FROM="SatSend <team@mail.satsend.me>"` in `.env` and the Vercel env vars, and change the Supabase custom SMTP sender (dashboard → Auth → SMTP Settings → Sender) to the same address. No code change is strictly needed for the Supabase half — it's a dashboard setting — but call it out in the `CHANGELOG` and the pre-deployment checklist so nobody later wonders why the address differs between envs.
- [x] README: in "Email notifications" → update the triggers/recipients table to show detected/confirmed emails go to **both** owner and payer; update the Supabase SMTP note to show the specific sender address.

**Tests**
- [x] Extend existing payment-status and cron-sweep route tests to assert two email dispatches per transition (one per recipient) and that the payer send is skipped when `client_email` is blank.
- [x] Extend `src/lib/email/send.ts` tests (or add one) to confirm the split templates render without throwing.

**Done when:** A single `pending → payment_detected` transition results in exactly two emails (one to owner, one to payer) unless the payer has no email on file. All transactional mail and all Supabase auth mail come from `team@mail.satsend.me`.

---

### ✅ v1.4.5 — PDF Polish: Filename Format + Dropdown Download

**Branch:** `v1.4.5/pdf-polish`

**Context:** Two small PDF improvements. The filename is currently `invoice-<invoiceName>.pdf`, which is ambiguous across freelancers ("who is this invoice from?" when the payer is filing receipts). And the PDF can only be downloaded from the invoice detail page — not from the `/invoices` per-row dropdown, where users expect all invoice actions to live.

**Scope**
- [x] Change the PDF filename format to `<sender>_<invoiceName>_<YYYYMMDD>.pdf`, where:
  - `<sender>` = `your_company` if set, else `your_name` if set, else the prefix of `your_email` (everything before `@`), else literal `invoice`. Sanitise to filesystem-safe chars (strip `/`, `\`, leading/trailing whitespace; collapse internal whitespace to `_`).
  - `<invoiceName>` = `invoice_number` if set, else the short id `…xxxxxxxx`. Same sanitisation.
  - `<YYYYMMDD>` = the date the invoice was published (fallback: created_at), in UTC.
- [x] Centralise the filename builder in a pure helper (e.g. `src/lib/invoices/pdf-filename.ts`) with full unit tests covering each fallback branch and the sanitisation.
- [x] Apply the helper to both callers: the existing detail-page download, and the new dropdown action.
- [x] Add a `Download PDF` action to the `/invoices` per-row dropdown (`src/app/(dashboard)/invoices/row-actions.tsx` or wherever the existing actions live). Only shows for non-draft invoices (drafts shouldn't have a public URL / PDF). Reuses the same server endpoint as the detail-page download.

**Tests**
- [x] `src/lib/invoices/pdf-filename.test.ts` — covers every fallback branch (`your_company` missing, `your_name` missing, email-prefix path, everything missing), bad-character sanitisation, and the date format.
- [x] Update the dropdown actions test to assert `Download PDF` appears for non-draft rows and is wired to the correct URL.
- [x] **PDF content redesign** (added late in the branch): `Date Created` + `Date Due` (with `"No due date"` fallback) labels in the meta block; clickable `View and pay online` hyperlink to the public invoice URL; brand-coloured header (pulled from new `src/lib/brand-colors.ts` module mirrored from `globals.css`); BIP-21 BTC QR code (no amount); clickable hyperlink to `buildSpotPriceUrl(currency)` (Coinbase spot endpoint). All driven by tests in `invoice-pdf.test.ts` using `pdf-parse`.
- [x] **Public `Download PDF` button** on `/invoice/[id]` plus a new unauthenticated route `/api/invoice/[id]/pdf` (uses `fetchPublicInvoice`, 404s on drafts).

**Done when:** A PDF downloaded from either the dropdown or the detail page saves as `<sender>_<invoiceName>_<YYYYMMDD>.pdf`, with all sensible fallbacks.

---

### ✅ v1.4.6 — Invoice UX Micro-fixes

**Branch:** `v1.4.6/invoice-ux-micro-fixes`

**Context:** A bundle of four independent UX annoyances reported during v1.4.1 manual testing. None of them warrant a branch on their own; grouped here for a single clean PR. (The original "Rename Mark as sent → Publish" item moved into **v1.4.8 — Publish vs Send-via-email split**, since the rename is now part of a larger state-machine change rather than a standalone label tweak.)

**Scope**
- [x] **Prefill and lock `your_email`** on `/invoices/new` and `/invoices/[id]/edit` — read `session.user.email` on the server render and inject it into the form as a read-only (disabled or `readonly`) field. Remove the field from `InvoiceFormSchema` validation on the client so users can't bypass. This collapses the "two emails" confusion (account email vs invoice sender email). Per-invoice override is an explicit future non-goal — call it out in a code comment; a future branch can add it back behind a toggle.
- [x] **Access codes: lowercase enforcement** — change the existing uppercase-on-input transform to lowercase-on-input. Typing `FOO12` becomes `foo12`. Easier to type on mobile, less ambiguous visually. Update `src/components/invoice-form.tsx` (or wherever the access code field lives) and the corresponding validation schema — no DB migration needed since existing codes are stored as-is; optionally write a one-off `UPDATE invoices SET access_code = lower(access_code)` if we want case-normalisation across existing rows.
- [x] **Feedback when archiving an unarchivable invoice** — today, attempting to archive an invoice that's already archived (or a status that doesn't support archive) silently fails. Add toast feedback with a specific reason, and/or disable the action in the dropdown with a tooltip.
- [x] **"Mark as overdue" missing from `/invoices` dropdown** for pending invoices — the detail page has the button, the list dropdown doesn't. Add it to the row-actions menu with the same conditional logic used on the detail page.

**Tests**
- [x] Update dropdown-actions tests to assert "Mark as overdue" appears with correct conditional visibility.
- [x] Update invoice-form tests to assert the email field is read-only and pre-filled from session.
- [x] Update access-code handling test to assert lowercase normalisation.

**Done when:** All four fixes are live and covered by tests; users can't enter mixed-case access codes.

---

### ✅ v1.4.7 — Drag-to-reorder Line Items

**Branch:** `v1.4.7/line-item-reorder`

**Context:** Line items on the invoice form are currently fixed in the order they were added. Users want to reorder them without delete-and-re-add, especially when the invoice has many items or when the natural ordering changes mid-edit. Drag handles on the right of each row are a familiar pattern.

**Scope**
- [x] Add a small drag handle (vertical-grip / six-dot icon) to the right of each line item row in `src/components/invoice-form.tsx`. Visible on hover (mobile: always visible).
- [x] Wire up drag-and-drop reordering of the line-items array using `@dnd-kit/core` + `@dnd-kit/sortable` — lightweight, accessible, framework-agnostic, well-suited to the modest payload of an invoice form. Avoid `react-beautiful-dnd` (deprecated, no React 19 support).
- [x] Keyboard a11y: arrow keys move focus, space picks up + space drops, escape cancels. `@dnd-kit` provides this out of the box.
- [x] Touch a11y: long-press to start drag on mobile.
- [x] Schema: line items already live as a JSONB array on `invoices`; ordering is positional within the array — no migration needed. Persist on form save like any other field.

**Tests**
- [x] Form test: reorder via drag (simulated via `@dnd-kit`'s testing utilities) → submit → assert the saved array reflects the new order.
- [x] Keyboard a11y test: focus the handle on row B, space, arrow up, space → row B is now above row A.

**Out of scope**
- Reordering line items on the public invoice view (it's read-only).
- Reordering line items on the rendered PDF (the PDF order matches what's in the DB; no UI for the payer).

**Done when:** Owners can drag any line item to a new position on `/invoices/new` and `/invoices/[id]/edit`, the new order persists on save, and keyboard-only users can do the same.

---

### ✅ v1.4.8 — Publish vs Send-via-email Split

**Branch:** `v1.4.8/publish-send-split`

**Context:** Today, "Publish" and "send the invoice email to the client" are coupled — clicking Publish (currently labelled "Mark as sent") creates the public URL *and* fires the published-invoice email in one server action. The owner has no way to publish privately and deliver the invoice through a different channel (in person, in-app messenger, postal). This branch decouples the two concerns:

- **Publish** = put the invoice into its "final" state (status = `pending`), creating the public URL. No email side-effect.
- **Send** = an explicit, separate step. Three sub-paths: "Send now via email" (fires the email + marks as sent), "Download and mark as sent" (downloads the PDF + marks as sent for manual delivery), or "Mark as sent" (just records the manual delivery).

Once an email has been *attempted* against the invoice (success or failure), "Send via email" is permanently disabled — re-attempts would hit the same `client_email`, which is currently immutable post-publish. Failed-email surfacing is handled in **v1.4.9**.

This branch also subsumes the **"Rename Mark as sent → Publish"** item that was previously slotted in v1.4.6, since the rename only makes sense in the context of the larger split.

**State-machine model**
"Sent" is **metadata on top of `pending`**, not a new status enum value. The payment lifecycle (`pending → payment_detected → paid`) is orthogonal to delivery — combining them would explode the status enum (`pending_unsent`, `pending_sent_email`, `pending_sent_manual`, …) and force every UI branch to switch on the cross product. Three new columns capture delivery state without touching the status enum.

**Schema — new migration `supabase/migrations/00XX_publish_send_split.sql`**

```sql
alter table invoices add column sent_at timestamptz;
alter table invoices add column send_method text check (send_method in ('email', 'manual'));
alter table invoices add column email_attempted_at timestamptz;
```

- `sent_at` — non-null when the invoice has been "delivered" (manually OR via successful email).
- `send_method` — non-null when `sent_at` is set; either `'email'` (successful email send) or `'manual'` (owner clicked Mark as sent / Download and mark as sent).
- `email_attempted_at` — set the moment a Resend `safeSend` for `type=invoice_published` is fired, **regardless of outcome**. Used to gate the "Send via email" option.

**Backfill**
- All existing **non-draft** invoices: `sent_at = created_at, send_method = 'email', email_attempted_at = created_at`. Rationale: previously, publish auto-sent the email, so the implicit historical state is "delivered via email at create time". Per user instruction, retroactively apply this state.
- Draft invoices: leave all three columns NULL.

**Publish-action UI — split-button menu**
The current "Publish" button (on the detail page and `/invoices` per-row dropdown for drafts) becomes a split-button. Clicking opens a menu with **four** options for a draft invoice:

| Option | Side effects |
|--------|--------------|
| **Send now via email** | Publish + fire email. On success: `status='pending', sent_at=now(), send_method='email', email_attempted_at=now()`. On failure: `status='pending', email_attempted_at=now()` (sent_at + send_method stay NULL). |
| **Download and mark as sent** | Publish + trigger PDF download + `status='pending', sent_at=now(), send_method='manual'`. No email. |
| **Mark as sent** | Publish + `status='pending', sent_at=now(), send_method='manual'`. No email, no download. |
| **Publish only (don't send yet)** | Publish, no delivery side-effect. `status='pending'`, all three new columns stay NULL. |

For an **already-published, not-yet-sent** invoice (status `pending` via "Publish only"), the same menu appears with **3 options** (the bottom row removed). For a **manually-marked-sent** invoice, "Send now via email" remains available since `email_attempted_at` is NULL — but the manual options ("Mark as sent" / "Download and mark as sent") are hidden because they are no-ops once `sent_at` is set (the existing "Download PDF" button covers that affordance). For an **email-attempted** invoice (sent or failed), the "Send now via email" item is disabled with a tooltip ("An email has already been attempted for this invoice; multiple sends are not supported").

**Final visibility matrix**

| State | Trigger label | Menu options |
|---|---|---|
| Draft | **Publish** | Send via email · Download and mark as sent · Mark as sent · Publish only |
| Published-only (`sent_at` NULL) | **Send** | Send via email · Download and mark as sent · Mark as sent |
| Manually-marked-sent (`sent_at` set, `email_attempted_at` NULL) | **Send** | Send via email *(only — disabled with tooltip if no `client_email`)* |
| Email attempted but failed (`email_attempted_at` set, `sent_at` NULL) | **Send** | Send via email *(disabled)* · Download and mark as sent · Mark as sent |
| Successfully delivered via email (`sent_at` + `email_attempted_at` both set) | (hidden) | — |
| Manually sent + email attempted (both set) | (hidden) | — |
| Archived | (hidden) | — |

> **Email delivery confirmation is "Resend-accepted", not "inbox-confirmed".** When `publishAndSendEmail` records `email_events.status = 'sent'`, it means the Resend API accepted the request — the email may still bounce later (invalid recipient, spam-block, etc.) and we won't know. True delivery confirmation requires a Resend webhook subscription that updates `email_events.status` post-acceptance; that's tracked as out-of-scope for v1.4.8 and v1.4.9 and will land in a later branch.

**Server actions**
Three new actions in `src/app/(dashboard)/invoices/actions.ts`:

- `publishInvoice(id)` — publish only, no delivery side-effect (this *replaces* the existing `publishInvoice`, which currently also fires the email).
- `publishAndSendEmail(id)` — publish + fire email. Returns the email-attempt outcome so the UI can show success/failure.
- `publishAndMarkSent(id, { withDownload: boolean })` — publish + record manual delivery. When `withDownload=true`, the action also returns the PDF stream.

The `email_events` table from v1.4.3 keeps recording every send attempt; the new `email_attempted_at` column is a denormalised flag for fast UI gating without an extra query.

**Surfacing — detail page + dropdown + status badge**
- Detail page: show "Sent via email on Apr 28" or "Marked as sent on Apr 28" as a small line under the status badge when `sent_at` is set.
- `/invoices` per-row dropdown: if not yet sent, show the same split-menu shape; if sent, show the static line.
- `/invoices` columns: small icon next to the status badge (envelope ✓ for email-sent, hand-mark ✓ for manual-sent, blank for not-sent), tooltip-driven to avoid visual noise.

**Email template — out of scope for this branch**
The existing `invoice-published.tsx` template is reused as-is when "Send now via email" fires. If the wording needs to be re-framed as a deliberate send rather than an auto-publish, do it in a separate small branch.

**Tests**
- [x] Publish only — no `email_events` row written, all three new columns NULL, public URL works.
- [x] Publish + send email (success) — one `email_events` row (`status=sent`), `sent_at` set, `send_method='email'`, `email_attempted_at` set.
- [x] Publish + send email (failure) — one `email_events` row (`status=failed`), `sent_at` NULL, `send_method` NULL, `email_attempted_at` set.
- [x] Publish + mark as sent — no `email_events` row, `sent_at` set, `send_method='manual'`, `email_attempted_at` NULL.
- [x] Publish + download and mark as sent — same as above. Response shape: `{ downloadUrl: "/api/invoices/<id>/pdf" }` (the client triggers the existing PDF endpoint via `window.location`, rather than streaming megabytes through a server-action JSON envelope — same end-user effect, simpler transport).
- [x] UI gate: after a failed email attempt, "Send via email" is disabled (assert disabled state in dropdown and detail page).
- [x] UI gate: after manual mark-as-sent (no email yet), "Send via email" is still enabled.
- [x] Backfill migration `0011_publish_send_split.sql` applied via `npx supabase db push`; all non-drafts get the three columns populated correctly; drafts unchanged.

**Out of scope**
- Email template re-wording (separate small branch later).
- Editing `client_email` post-publish (would change failed-email retry semantics; deferred — see v1.4.9 "out of scope" notes).
- Re-enabling "Send via email" after a successful manual-then-email-failed sequence.

**Done when:** Owners can publish privately, choose between four send paths, and the system distinguishes "delivered via email" from "delivered manually" cleanly. Repeated email sends are prevented; the existing `email_events` audit trail still records every attempt.

---

### ✅ v1.4.9 — Failed Email Surfacing

**Branch:** `v1.4.9/failed-email-surfacing`

**Context:** v1.4.8 introduces the rule that "Send via email" is permanently disabled once an email attempt has been made — even if that attempt failed. This is correct behaviour (re-trying with the same `client_email` will keep failing, and editing `client_email` post-publish isn't supported yet), but it leaves a hole: today the owner has no clear visual signal that an email attempt failed. They have to dig into the v1.4.3 email-events activity card on the detail page to find out.

This branch makes failed-email state a first-class signal in the dashboard.

**Implementation note (revised during build):** rather than deriving failed-email state in the page layer, v1.4.9 introduces a Postgres view `invoice_email_summary` (migration `0012`) that left-joins each invoice to its most-recent `invoice_published` row in `email_events`. The `/invoices` list reads from the view directly, exposing `last_publish_email_status`, `last_publish_email_error`, and `last_publish_email_at` as first-class fields. This keeps `email_events` as the single source of truth, makes the row-level indicator read a real DB field (not an app-derived flag), and means a future Resend bounce/complaint webhook only writes/updates `email_events` — the UI reflects automatically.

**Scope decisions during build:**
- A detail-page alert at the top of the invoice was scoped out — the existing **Email Activity** card (v1.4.3) already shows the per-attempt failure reason in red, and a duplicate alert at the top of the page was redundant.
- The "Email failed" filter toggle on `/invoices` was scoped out — too niche relative to the per-row indicator, which already gives at-a-glance recognition.

**Scope (final)**
- [x] `/invoices` per-row visual cue — a small `AlertCircle` indicator next to the status badge for any invoice with a failed last email-publish. Tooltip: "Email failed to send to this client". On rows that were sent via email but the email failed, the failed indicator replaces (does not stack with) the sent-method icon.
- [x] Source the failed-email state from the new `invoice_email_summary` view.

**Out of scope (deferred)**
- **Editing `client_email` post-publish + retrying email**. Requires careful auditing of identity changes and re-enable semantics. Likely a v1.5 / v1.6 branch.
- Bounce / complaint webhooks from Resend feeding back into `email_events.status` automatically. Currently we only know send-time `status=sent` vs `status=failed`. Resend's webhook for bounces (post-send-but-undeliverable) could update the same row to `status=bounced` — useful but separable. The view structure is already compatible.

**Tests**
- [x] List-page test: per-row indicator renders for failed-publish rows and is absent on successful rows.
- [x] List-page test: failed indicator replaces (does not stack with) the sent-via-email icon on a row that was sent via email but failed.

**Done when:** A failed email is visible at a glance from the dashboard list, without the owner having to open the detail page or expand the email-events activity card.

---

### ✅ v1.4.10 — Invoice Activity Feed (rename + unify manual events)

**Branch:** `v1.4.10/invoice-activity-feed`

**Context:** v1.4.3 introduced the **Email Activity** card on the invoice detail page — a clean, row-based feed of every transactional email attempt for the invoice. It is the right *shape* for an audit trail, but its scope is too narrow: today the owner can see when an email was sent, but not when the invoice was published, marked as sent, marked as paid, or marked as overdue. Those manual state transitions are equally informative and currently invisible. This branch generalises the card into a single "Invoice Activity" feed covering all of these.

**Renames**
- The card title changes from **Email Activity** → **Activity** (or **Invoice Activity** — exact wording TBD in implementation; one source of truth).
- The component file `src/app/(dashboard)/invoices/[id]/email-activity-card.tsx` is renamed to `invoice-activity-card.tsx` (or similar). The detail-page import in `page.tsx` updates accordingly.

**New event types**
Beyond the existing `invoice_published` / `payment_detected` / `payment_confirmed` email events, the feed now surfaces:

| Event | Trigger | Icon |
|---|---|---|
| Email sent (any type) | existing `email_events` row with `status=sent` | envelope (`Mail`) |
| Email failed | existing `email_events` row with `status=failed` | envelope with strike / alert variant — same family for visual cohesion |
| **Marked as sent** | `publishAndMarkSent` action sets `sent_at` with `send_method='manual'` | `Send` / paper-plane icon |
| **Marked as paid** | `markPaid` action flips status `→ paid` | `CheckCircle` / receipt icon |
| **Marked as overdue** | `markOverdue` action flips status `→ overdue` | `Clock` / alarm icon |

All email-related events share **one icon family** (envelope) per the user's preference; manual state transitions each get a **distinct, semantically appropriate icon** (lucide-react has the relevant ones — final selection in implementation, but the constraint is "clean, not over-decorated").

**Schema — new migration `supabase/migrations/00XX_invoice_activity_events.sql`**
- New table `invoice_events` (or extend the naming pattern from `email_events`):
  ```sql
  create type invoice_event_type as enum (
    'marked_as_sent',
    'marked_as_paid',
    'marked_as_overdue'
  );

  create table invoice_events (
    id          uuid primary key default gen_random_uuid(),
    invoice_id  uuid not null references invoices(id) on delete cascade,
    user_id     uuid not null references auth.users(id) on delete cascade,
    event_type  invoice_event_type not null,
    created_at  timestamptz not null default now()
  );

  create index invoice_events_invoice_id_idx on invoice_events (invoice_id, created_at desc);
  alter table invoice_events enable row level security;
  create policy "owner can read own invoice events" on invoice_events
    for select using (auth.uid() = user_id);
  ```
- Server-side writes only (service role) — no anon insert policy.
- **No backfill.** Pre-v1.4.10 invoices show only their email events; new manual transitions accumulate from the migration date forward. (Backfilling from `invoices.sent_at` etc. is possible but not worth the complication.)

**Server-action wiring**
- `publishAndMarkSent` writes a `marked_as_sent` row alongside the `sent_at` update.
- `markPaid` writes a `marked_as_paid` row.
- `markOverdue` writes a `marked_as_overdue` row.
- Failures to insert an `invoice_events` row are logged but do **not** block the primary state transition (mirrors the safeSend pattern in `email/send.ts`).

**Activity card — fetch + render**
- The card fetches both `email_events` and `invoice_events` for the invoice (single round trip if possible, otherwise two parallel queries) and merges them into one chronologically sorted list.
- Each row: small icon (left) · short label (e.g. "Email sent to ada@example.com" / "Marked as sent") · relative time (right, e.g. "2 hours ago") with a hover-tooltip showing the absolute timestamp.
- No new dependencies; lucide-react already provides Mail / Send / CheckCircle / Clock / AlertCircle.
- Visual rule: keep the row height tight, no per-row borders inside the card, no expandable rows. The card is a glanceable feed, not a debugger.

**Tests**
- [x] Migration applied; `invoice_events` table + RLS policy present.
- [x] `publishAndMarkSent` writes a `marked_as_sent` row in addition to the existing `sent_at` update.
- [x] `markPaid` writes a `marked_as_paid` row.
- [x] `markOverdue` writes a `marked_as_overdue` row.
- [x] Activity card renders email events and manual events merged into one chronological list.
- [x] Activity card uses the correct icon family for emails and a distinct icon per manual event.
- [x] If `invoice_events` insert errors, the primary state transition still succeeds (smoke test).
- [x] Card title is "Activity" / "Invoice Activity" (final wording — pick one and stick with it).

**Out of scope**
- Surfacing the activity feed anywhere outside the invoice detail page (e.g., a global activity stream).
- Backfilling pre-migration manual events from `invoices.sent_at`, status history, etc.
- Linking activity rows to "undo" or "view details" actions.

**Done when:** The invoice detail page has one consolidated **Activity** card showing both email attempts and the three manual state transitions, each with its own icon, ordered most-recent-first.

---

### ✅ v1.4.11 — Overdue Automation

**Branch:** `v1.4.11/overdue-automation`

**Context:** Today "overdue" is a fully manual status — the owner has to remember to click "Mark as overdue" after a due date passes, and the "Mark as overdue" button is offered indiscriminately even on invoices with no due date or with a due date in the future. This branch formalises the four cases into a tight state machine and automates the common one (case #1).

**Cases (from the user)**
- Case #1 — Invoice has a due date **in the past** and is unpaid → auto-flip status to `overdue` without owner intervention.
- Case #2 — Invoice has a due date **in the future** and is unpaid → **no** "Mark as overdue" button anywhere.
- Case #3 — Invoice has **no due date** and is unpaid → "Mark as overdue" button available (on both dropdown and detail page).
- Case #4 — Invoice has **no due date** and is `overdue` → "Mark as pending" button available (reverses case #3).

**Scope**
- [x] Case #1 automation — extended the existing `/api/cron/payment-sweep` route with a sibling sweep (`sweepOverdue` helper) that runs every cron tick. Decision lives in a new pure fn `decideOverdueFlip()` in `src/lib/invoices/overdue-actions.ts`. The flip uses optimistic concurrency (`.eq("status", "pending")`) so a payment landing in the same tick wins. Cron response now includes an `overdueFlips` counter. Activity feed records `marked_as_overdue` (same event type as the manual flow).
- [x] **Synchronous flip at publish time.** Discovered during dev testing that the cron-only flip leaves freshly published past-due invoices showing as `pending` for up to ~60s in production and indefinitely in dev. Fixed in `applyPublishUpdate` (the chokepoint for `publishInvoice` / `publishAndSendEmail` / `publishAndMarkSent`) by calling `decideOverdueFlip` against the loaded invoice and writing `status='overdue'` directly when applicable.
- [x] Alternative considered: a scheduled DB job / trigger doing the status flip without Next.js involvement. Rejected for v1.4 because it splits the source of truth; keeping all state transitions in TypeScript is simpler to test.
- [x] Cases #2 / #3 / #4 — conditional rendering wired through `canMarkAsOverdue(invoice)` / `canMarkAsPending(invoice)` in `src/lib/invoices/overdue-actions.ts`. `MarkAsMenu` (detail page) accepts a new `dueDate` prop and gates Overdue / Pending items via the helper; the row dropdown in `columns.tsx` does the same and adds a new "Mark as pending" item wired to the existing `markUnpaid` action.
- [x] Status badge shows "Overdue" when auto-flipped — verified, no code change (badge reads from `status`).
- [x] Email notification on auto-flip — deferred. See "Out of scope" below.

**Tests**
- [x] `decideOverdueFlip` — 7 unit tests covering pending+past, pending+today, pending+future, pending+no-due, payment_detected+past, paid+past, already-overdue+past.
- [x] Helper visibility logic — 12 unit tests covering all 4 cases plus the paid/draft/already-overdue edge cases.
- [x] Integration-ish cron test — past-due pending row flips to overdue and logs `marked_as_overdue`; same-day row does not flip; no-rows path returns `overdueFlips: 0`.

**Out of scope**
- Email notification for auto-overdue flip.
- Configurable grace period (e.g. "mark as overdue 3 days after due date"). For now, flip the instant `due_date < now()`.

**Done when:** An unpaid invoice with a past due date auto-flips to overdue at the next cron tick without owner action; the "Mark as overdue" and "Mark as pending" buttons appear on the correct surfaces only in the right states.

---

### ✅ v1.4.12 — BTC Address Hardening

**Branch:** `v1.4.12/btc-address-hardening`

**Context:** Two real gaps in BTC address validation and mempool URL handling, addressed in this version. A third candidate (soft-delete to prevent address reuse from deleted invoices) was considered and dropped — see "Scope considered and rejected" below.

1. **Already-used addresses.** A freelancer pastes in a BTC address that already has on-chain history (e.g. reuse from a previous wallet, or a known-public address). mempool.space's balance + tx history gives this away. We reject addresses with any prior receive history at publish time — defending against both false-positive detections (prior txs matching the BTC amount) and weak operational security (address reuse leaks counterparty privacy).
2. **Mempool transaction URLs in emails are not network-aware.** The public invoice page and the payment-detected/confirmed emails both link to mempool.space, but `src/lib/email/send.ts` hard-coded `https://mempool.space/tx/<txid>` while the UI used a network-aware helper that emits `https://mempool.space/testnet4/tx/<txid>` on testnet. On testnet the email link 404s (or worse, shows an unrelated mainnet tx of the same id). Both surfaces now call the same `mempoolTxUrl(txid)` helper that respects `NEXT_PUBLIC_BTC_NETWORK`.

**Scope — pre-publish balance check**
- [x] Add `addressHasHistory(address)` helper to `src/lib/mempool.ts` calling `GET /api/address/<addr>` and returning `true` iff `chain_stats.tx_count > 0` or `mempool_stats.tx_count > 0`. Returns `null` when mempool is unreachable.
- [x] Wire into `loadAndAuthorise` in `src/app/(dashboard)/invoices/actions.ts`. Reject with: "This address has already received transactions — use a fresh address for each invoice."
- [x] Graceful failure: if mempool.space is unreachable, allow publish and log `[publish] mempool.space unreachable, address history check skipped for invoice <id>`. Test in `src/app/(dashboard)/invoices/actions.test.ts` asserts the fallback.
- [x] Network-awareness comes free via `getMempoolBaseUrl()`.
- [x] README's "Bitcoin address policy" section updated — flipped from "planned in v1.4.12" to current statement of behaviour, including the mempool-down fallback rule.

**Scope — network-aware mempool URLs everywhere**
- [x] Added `mempoolTxUrl(txid)` and `mempoolAddressUrl(address)` to `src/lib/btc-network.ts`.
- [x] Replaced the hand-rolled `mempoolLink` in `src/lib/email/send.ts` with `mempoolTxUrl`. Removed the now-unused `NEXT_PUBLIC_MEMPOOL_BASE_URL` env-var override.
- [x] Replaced the inline `${getMempoolBaseUrl()}/address/...` in `src/app/invoice/[id]/mark-sent-button.tsx` with `mempoolAddressUrl`.
- [x] Audit (`grep -rn "mempool.space" src/`) confirms every URL now flows through `btc-network.ts`. Remaining matches are display strings ("View on mempool.space"), comments, and the helper itself.
- [x] Parity tests in `src/lib/email/send.test.ts` render the email HTML under both `NEXT_PUBLIC_BTC_NETWORK=mainnet` and `=testnet4` and assert the link matches `mempoolTxUrl(txid)` for that network.

**Scope considered and rejected — soft-delete for deleted-invoice reuse**

The original plan included soft-deleting invoices so a deleted invoice's BTC address would still block reuse. On reflection this was overkill given the balance check:

- Paid-and-deleted addresses always have on-chain history → already rejected by the balance check.
- Unpaid-and-deleted addresses have no history and no in-flight payment → reusing them is harmless (the deleted invoice is gone, no detection cross-talk possible).
- The narrow remaining case (invoice paid → owner deletes within seconds → address reused before tx confirms in mempool) is vanishingly rare and not materially worse than manual address reuse outside the system.

The complexity cost (new enum value, `deleted_at` column, query rewrites across list/detail/realtime/exports) didn't earn its keep. Soft-delete may revisit if/when we add a "delete published invoice" feature with different semantics.

**Tests added**
- [x] `src/lib/mempool.test.ts` — `addressHasHistory` returns true for chain history, true for mempool pending, false for fresh, null for non-OK and thrown fetch.
- [x] `src/app/(dashboard)/invoices/actions.test.ts` — publish rejects on history, proceeds on fresh, proceeds with warning on mempool failure.
- [x] `src/lib/btc-network.test.ts` — `mempoolTxUrl` / `mempoolAddressUrl` produce the right URL on mainnet vs testnet4.
- [x] `src/lib/email/send.test.ts` — payment-detected email URL parity with `mempoolTxUrl`, both networks.

**Done:** Owners cannot publish an invoice against any address with prior on-chain or mempool activity (network-aware), and every mempool.space URL in the product is generated through a single network-aware helper. Manual test guide: `manual-tests/v1.4.12-btc-address-hardening.md`.

**Hotfix added during testing — three further bugs discovered and resolved on this branch:**

1. **`payment-status` route accepted transitions from any status.** The route's `STATUS_ORDER` map had no entry for `draft` (or `archived`), so the `?? -1` fallback meant any incoming `paid` / `payment_detected` passed the gate. A `PaymentWatcher` running against a draft with a poisoned address could flip the draft straight to paid. Fixed by adding an explicit `PAYABLE_STATUSES` allow-list in `src/app/api/invoices/[id]/payment-status/route.ts` — only `pending`, `payment_detected`, `overdue` accept transitions; everything else returns 409 Conflict before the DB write.
2. **Dashboard detail page mounted `PaymentWatcher` for drafts.** The conditional in `src/app/(dashboard)/invoices/[id]/page.tsx` only checked `accepts_bitcoin && btc_address`, so a draft with an address would spawn a watcher that polled mempool and POSTed against the route. Now also gated on `status ∈ {pending, payment_detected, overdue}`.
3. **Freshness check fired only on publish, not on save-draft.** Bad addresses could land in the DB on `saveDraft` / `updateDraft`. Extracted `assertAddressFreshness` helper in `src/app/(dashboard)/invoices/actions.ts` and called from all three entrypoints (saveDraft, updateDraft, loadAndAuthorise). Same fail-open behaviour everywhere.

Tests added: route 409 for draft / archived, route accept for overdue, dashboard page no-watcher-for-draft / no-watcher-for-archived, saveDraft and updateDraft reject on history, saveDraft fail-open on mempool unreachable.

---

### ✅ v1.4.13 — Payment Detection Latency (no "Mark as Sent" path)

**Branch:** `v1.4.13/payment-detection-latency`

**Context:** In v1.3.3 we shipped the "Mark as Payment Sent" dialog which front-loads mempool.space polling (5×2s + 5×3s + 3×5s + 2×10s = 15 polls / 60s). When the payer clicks that button, detection is fast — 2–10 seconds typical. But when the payer *doesn't* click it (just pays and closes the tab, or doesn't notice the button), detection falls back to the passive WebSocket watcher (A) and the background cron (C). The WebSocket is usually instant — but if it drops, the fallback polling starts at 10s and exponentially backs off. And if the tab closes before the WebSocket sees the tx, the payer has to wait for the cron — which is minute-granular at best, and the first cron-side poll is scheduled for +1m post-publish.

Real-world testing showed end-to-end latency in the "paid without clicking the button" case ranged from 10s (lucky WebSocket) to a minute+ (cron-only). The ask is: can we narrow the gap?

**Research phase (pre-implementation)**
- [x] Document the exact request path and timing of each of the four detection mechanisms A/B/C/D with a Chrome DevTools capture: what requests fire, when, against which endpoints.
- [x] Compare the "button-clicked" path (B) vs the "button-not-clicked" path (A + C) to identify the gap. Specifically: is the passive WebSocket reliably catching 0-conf tx broadcasts, or is it often the cron that wins?
- [x] Look at mempool.space rate limits per IP — are we leaving headroom to poll more aggressively from the client?

**Implementation options (pick after research)**
- [x] Option 1: **Lower the passive WebSocket fallback-polling start** from 10s → 2s (mirroring the "button clicked" cadence for the first 10–30 seconds after page open). Simpler; doesn't require the payer to do anything.
- [ ] Option 2: **Auto-trigger the button-clicked polling schedule** as soon as the payer scans / reveals the BTC address, without waiting for them to click. Benefit: full 60s-tiered cadence starts the moment they commit to paying. Risk: extra mempool.space load for every viewer. *(Skipped — WebSocket already covers the 99% case; extra load not justified.)*
- [x] Option 3: **Tighten the cron's first scheduled check** from +1m to +15s post-publish, so even a closed-tab payer gets sub-minute detection from the server side. Cost: cron runs at up to 15s granularity per invoice — well within rate limit.
- [x] Option 4: Some combination. Likely 1 + 3. *(Chose 1+3.)*

**Tests**
- [x] Whatever path is chosen: unit tests for the new cadence, integration test simulating "pay but don't click" to assert detection latency is within the new target.

**Bug to fix in this branch — txid not displayed on the public invoice page until manual refresh.**

When a payment is detected on the public invoice page (`src/app/invoice/[id]/`), the `PaymentWatcher` flips the local status state via `onStatusChange`, but the transaction id is never threaded into the rendered view. The `btc_txid` column is updated in the DB by the `payment-status` route, and the dashboard detail page picks it up via `InvoiceDetailRealtime`, but the public page does not — the payer has to refresh to see the txid and the mempool.space link.

- [x] Audit `src/app/invoice/[id]/use-public-invoice-realtime.ts` — does the Supabase realtime subscription include `btc_txid` in its payload? If `replica identity` for the row is `full` (per migration `0006_invoices_replica_identity_full.sql`) it should already; verify the merge logic in the hook actually applies the new field rather than dropping it. *(Confirmed: payload carries btc_txid; bug was in the consumer `InvoicePaymentView`, which only spread `status`.)*
- [x] Alternatively, since the public page already calls `PaymentWatcher` which knows the txid the moment it POSTs to `/api/invoices/<id>/payment-status`, plumb the txid back via `onStatusChange`'s callback signature (or a new `onTxidDetected` prop) so the UI can render it without waiting for the realtime roundtrip.
- [x] Decide between the two approaches based on whichever is simpler for the realtime audit. Default: extend the watcher callback (more direct, no Supabase realtime dependency). *(Did both: extended `onStatusChange(status, txid?)` AND made the realtime consumer spread `btc_txid` into local state — defense in depth for the cron-only path.)*
- [x] Test: render the public page with status `pending`, simulate the watcher reporting a tx, assert the txid + mempool link appear without a re-render of the page-level data fetch.

**Done when:** With "paid but button not clicked" as the scenario, detection happens within a measurably better bound than today (target: < 15s p50, < 60s p95), documented in the README. AND the public invoice page renders the txid + mempool link the moment payment is detected, with no manual refresh required.

---

### ✅ v1.4.14 — Bitcoin-Only Focus

**Branch:** `v1.4.14/bitcoin-only-focus`

> **Pivot note (2026-05-07):** This slot was originally scoped for a fiat payment flow, manual confirmation, and conditional mark-as-unpaid. That work is preserved as a single WIP commit on `origin/v1.4.14/fiat-payment-and-manual-confirmation` (not merged) and may be revived post-launch. The v1 product is now bitcoin-only.

**Context:** SatSend v1 launches as a bitcoin-only invoicing product. Users who want fiat-payment rails have a thousand other tools to choose from; trying to support both adds surface area, complicates the data model, and dilutes positioning. This branch removes every code path that gates Bitcoin behind an opt-in or treats fiat as a payment method, and forces every published invoice to carry a Bitcoin address.

**Important boundary:** fiat stays as the **unit of account** (invoices remain denominated in USD/GBP/etc; line items, totals, and PDF ordering do not change). What goes away is fiat as a **payment method** and the optional "Accept Bitcoin" gate.

**Scope**

1. **Drop the `accepts_bitcoin` toggle entirely.**
   - Migration: drop the `accepts_bitcoin` column from `invoices`.
   - Invoice form: remove the checkbox; remove every code path that branches on `accepts_bitcoin`.
   - Invoice detail page (`src/app/(dashboard)/invoices/[id]/page.tsx`): drop the `invoice.accepts_bitcoin && invoice.btc_address` gate.
   - Public payer page: same. Bitcoin payment is the only path; no conditional render.
   - Audit: `grep -ri "accepts_bitcoin\|acceptsBitcoin" src/` must return zero hits after the branch lands.

2. **Make `btc_address` mandatory at publish time, not at draft save.**
   - `btc_address` stays nullable in the schema. Drafts can be saved without one.
   - The `publishInvoice` server action rejects any invoice without a valid `btc_address` (returns a structured validation error so the form can highlight the field).
   - DB-level guard: a check constraint enforcing `btc_address is not null` whenever `status != 'draft'`. Belt-and-braces with the action-layer check; protects against direct DB writes / future code paths.
   - Form-level: required field on publish, with helper text ("Required to publish, not required to save draft"). The field stays editable until publish; once published, the existing v1.4.12 freshness rules continue to apply.
   - **Address remains unique per invoice.** No account-level default, no copy-from-previous-invoice. Reusing an address across invoices breaks payment detection (v1.4.12 freshness rule) and is a privacy regression. This is a hard constraint, not a UX choice.

3. **Remove every fiat-payment affordance from the public payer page.**
   - Only "Pay with Bitcoin" renders. No "Pay with [currency]" button, no "I paid via [other method]" escape hatch.
   - Owner side: no "received off-platform" confirmation flow. Audit `mark-as-menu.tsx`, `invoice-actions.tsx`, and the dashboard row dropdown to confirm no surface assumes a fiat-payment path exists.

4. **Email templates: bitcoin-centric copy, no QR codes in emails.**
   - Reasoning: QR codes encode the BTC amount, computed live from a fiat conversion at view time. An email-time QR would show a stale BTC amount whenever the price moves. Emails link to the live invoice page; QR rendering stays on the public payer page only.
   - `invoice_published`: subject and body should clearly indicate this is a bitcoin invoice. CTA links to the public invoice URL (live QR + address there).
   - `payment_detected`, `payment_confirmed`, `overdue_*`: audit copy. Remove any phrasing that implies fiat is a supported payment method.

5. **PDF: no structural change.**
   - Fiat totals continue to lead the document (unit of account). Bitcoin payment block stays in its current position. This is intentional; PDFs are downloaded once and shown later, often when no live BTC quote is available, so leading with fiat is correct.

6. **Status / activity copy stays generic.**
   - "Awaiting payment" continues to render as-is; no need to qualify with "Bitcoin" since bitcoin is the only payment option. Shorter, cleaner.

> **Marketing / landing copy is OUT of scope for v1.4.14.** The bitcoin-only positioning needs to land on a real marketing page that does not yet exist. Tracked as a separate entry (v1.4.23 below). This branch limits itself to in-app and in-product changes.

**Schema migrations**

This branch carries two migrations because the abandoned fiat work (0015, 0016) was already applied to the remote DB before the pivot. To keep history linear and auditable, both 0015 and 0016 are cherry-picked into this branch (so local matches remote) and reversed by 0017. The bitcoin-only schema change then lands as 0018.

- `0015_fiat_and_manual_confirmation.sql` (cherry-picked from `origin/v1.4.14/fiat-payment-and-manual-confirmation`).
- `0016_payment_confirmed_event_type.sql` (cherry-picked from same).
- `0017_revert_fiat_and_manual_confirmation.sql` — drops the three columns, drops the two custom types, recreates `invoice_status` without `marked_as_paid`, recreates `invoice_event_type` without `payment_confirmed`. Defensive pre-clean of any rows referencing the removed values (expected zero on production).
- `0018_bitcoin_only.sql` — the bitcoin-only change:

```sql
-- Bitcoin is no longer optional; every invoice accepts BTC.
alter table invoices drop column accepts_bitcoin;

-- BTC address required for any non-draft invoice.
alter table invoices add constraint btc_address_required_when_published
  check (status = 'draft' or btc_address is not null);
```

Backfill: audit existing rows for any `status != 'draft' and btc_address is null` before adding the constraint. If any exist (likely none, given v1.4.12), decide per-row whether to delete, downgrade to draft, or supply an address. Migration body should `select count(*)` first and abort on non-zero, forcing manual reconciliation.

**Tests**
- [ ] Server action: `publishInvoice` without `btc_address` returns a structured validation error; the response is shaped for the form to highlight the field.
- [ ] Server action: `saveDraft` (or equivalent) without `btc_address` succeeds; status stays `draft`.
- [ ] Server action: publishing an invoice with a valid `btc_address` succeeds and transitions out of `draft`.
- [ ] Schema: migration runs cleanly on a fresh DB. Constraint rejects a direct insert of `(status='pending', btc_address=null)`.
- [ ] Public payer page: only the bitcoin payment affordance renders; no fiat button under any data shape.
- [ ] Codebase audit: `grep -ri "accepts_bitcoin\|acceptsBitcoin" src/` returns zero hits.
- [ ] Email-template snapshot tests: no copy implies fiat is a supported payment method.

**Out of scope (deferred)**
- **Owner-side "received off-platform" escape hatch.** Lost-address recovery, out-of-band proof, etc. Edge case for v2; revisit if real users hit it.
- **Partial / under / overpayment handling.** Already queued in v1.4.19 (Payment Amount Awareness). v1.4.14 must not block on it but must not regress current behaviour either: today's detector flips on any tx; v1.4.19 adds the 5% tolerance band. Current behaviour is acknowledged-but-imperfect for v1 launch.
- **Account-level default BTC address.** Explicitly rejected: addresses must be unique per invoice (v1.4.12 freshness rule + privacy).

**Done when:**
- `accepts_bitcoin` is gone from schema, code, and tests.
- An invoice cannot transition out of `draft` without a valid `btc_address`, enforced both at the action layer and the DB layer.
- The public payer page offers Bitcoin as the only payment method.
- No email or in-app copy implies fiat is a payment option.
- The per-invoice address-uniqueness guarantee from v1.4.12 is preserved.
- Marketing-facing copy work is deliberately deferred to v1.4.23 (a marketing page does not yet exist; building it is a separate concern from the in-app pivot).

---

### ✅ v1.4.14.1 — Reconcile pre-v1.4.12 invoices for migration 0018

**Branch:** `v1.4.14.1/reconcile-pre-v1-4-12-invoices`

**Context:** When `0018_bitcoin_only.sql` was pushed to remote after the v1.4.14 merge, its defensive audit aborted with: *"24 invoice(s) have status != draft and btc_address is null."* These rows predate v1.4.12 (which added the publish-time `btc_address` requirement at the action layer); before that gate landed, the form allowed publishing without one.

Inspection of all 24 confirmed they are abandoned test data: trivial totals (mostly $0 or $0.50), empty client_name, invoice_numbers like `TESTY` / `DRAFTY` / `FailedEmail` / `this one is paid`. No real client data, no real bitcoin payments to preserve.

**Scope**

- [ ] New migration `0019_reconcile_pre_v1_4_12_invoices.sql`. One statement: `delete from invoices where status != 'draft' and btc_address is null`. Cascading FKs on `email_events` and `invoice_events` clean up related rows automatically.
- [ ] After 0019 lands on remote, re-run `npx supabase db push` to apply 0018 (now with zero offenders, the audit passes and the constraint + column drop succeed).
- [ ] Update `CHANGELOG.md` with a v1.4.14.1 entry capturing the reconciliation.

**Why a separate branch + entry:** The user's working convention is that every change — including hotfixes and post-merge reconciliation patches — lives on its own branch with its own roadmap entry. Direct commits to `main` are not allowed.

**Out of scope**
- Any code changes. This branch is migration-only.
- Backfilling addresses for the deleted rows. They were junk; the simpler reconciliation is to delete.

**Done when:** `0019` is merged on main, `0018` applies cleanly on remote (zero offenders), and the v1.4.14 constraint + column-drop is fully landed.

---

### ✅ v1.4.14.2 — Migration 0018 self-healing fix

**Branch:** `v1.4.14.2/migration-order-fix`

**Context:** v1.4.14.1 added migration `0019` to delete the 24 abandoned test invoices that violated the publish-time `btc_address` invariant. Plan was: 0019 deletes junk → 0018 retries cleanly. But the Supabase CLI applies migrations in filename order, so on the next `db push` `0018` ran first, hit its defensive `raise exception` abort (because the offenders were still there), and `0019` never got a chance to run.

The fix is to make `0018` self-healing: instead of aborting on non-zero offenders, delete them inline. The constraint added in step 2 of the same migration then guarantees the state can never recur.

**Scope**

- [ ] Edit `0018_bitcoin_only.sql`. Replace the `raise exception` block with a `delete from invoices where status != 'draft' and btc_address is null`, plus a `raise notice` so the deleted count is visible in the migration log. Migration content is otherwise unchanged: same constraint add, same column drop. Cascading FKs handle related rows.
- [ ] `0019` stays as-is. After this branch merges and `db push` runs, `0019`'s `delete` matches zero rows (because `0018` already cleared them) and is a documented no-op. Keeps the v1.4.14.1 audit trail intact.
- [ ] Update CHANGELOG with v1.4.14.2 entry.

**Why edit the merged 0018 instead of renaming or splitting:** Editing a migration file that has not yet been applied to remote (which 0018 hasn't, due to the abort) is safe — the supabase CLI re-reads the file content on each push. Renaming `0018` → `0020` to force order would propagate stale references through the v1.4.14 roadmap and CHANGELOG. Inlining the cleanup keeps `0018` as the single "make-the-schema-bitcoin-only" migration it was designed to be, just less brittle against legacy data.

**Out of scope**
- Removing or modifying `0019`. Even though it is now redundant, leaving it preserves the v1.4.14.1 history and costs nothing.
- Any code changes. Migration-only branch.

**Done when:** `0018` is self-healing, `npx supabase db push` from main applies both `0018` (deletes any offenders, adds the constraint, drops `accepts_bitcoin`) and `0019` (no-op) cleanly; remote schema matches local migration state at version `0019`; the v1.4.14 column-drop and CHECK constraint are both in place.

---

### ✅ v1.4.14.3 — Migration 0018 view-dependency fix

**Branch:** `v1.4.14.3/migration-view-dependency-fix`

**Context:** v1.4.14.2's self-healing fix to `0018` got past the offenders abort but tripped on a different obstacle: the `invoice_email_summary` view (created in migration `0012`) does `select i.*` from `invoices`, which captures every column including `accepts_bitcoin`. Postgres blocks `drop column` whenever a view references the column, so `0018` errored at `alter table invoices drop column accepts_bitcoin`.

The exact same drop-and-recreate pattern was already used in `0017` for the same view; I just missed adding it to `0018`. This branch closes that gap.

**Workflow note:** Per durable convention adopted with this branch, the migration was tested against remote *before* the PR was opened. `npx supabase db push` from this branch applied `0018` cleanly (the offenders deletion logged a NOTICE for 24 rows, the view was dropped/recreated, the column was dropped, the constraint was added). Migration tracking now shows local and remote both at `0019`. The PR ceremony is now formality only — the schema change is already landed.

**Scope**

- [ ] Edit `0018_bitcoin_only.sql`. Between step 2 (constraint add) and the column drop, add `drop view if exists invoice_email_summary`. After the column drop, add a verbatim `create or replace view invoice_email_summary as select i.*, ... from invoices i left join lateral (...) e on true` matching the original from `0012`.
- [ ] Update CHANGELOG with v1.4.14.3 entry.

**Out of scope**
- Changing how the view is defined (e.g. naming columns explicitly instead of `select i.*`). That would avoid this dance forever, but it's a wider change than this hotfix's scope.

**Done when:** `0018`'s edited file matches what was actually applied to remote; the view drop/recreate pattern is documented inline; CHANGELOG has the v1.4.14.3 entry; PR merges so main's git history matches the remote DB state.

---

### ✅ v1.4.15 — Rename Paybitty → SatSend

**Branch:** `v1.4.15/rename-to-satsend`

**Context:** The product has been renamed from **Paybitty** to **SatSend**. This is the rename branch — purely mechanical, no behaviour changes. Lands as the final patch in the v1.4 train so that the v1.5 design-system overhaul starts from a clean-branded codebase.

**Scope**
- [x] `package.json` — `name` field (also affects lockfile; regenerate via `npm install`).
- [x] All email templates in `src/lib/email/templates/*.tsx` — subject lines, body copy, preview text.
- [x] All page metadata: `src/app/layout.tsx` (`title`, `description`, `openGraph`), per-route metadata, favicon + manifest if branded.
- [x] Navbar logo text (`src/components/nav.tsx` or equivalent).
- [x] All hard-coded UI copy — run `grep -ri "paybitty" src/` and address every hit. Common categories: loading states, toast text, button labels, empty-state illustrations' alt text.
- [x] All docs: `README.md`, `CHANGELOG.md` (only in the current-version preamble, not historical entries — those stay for provenance), `AGENTS.md`, `CLAUDE.md`, `development/ROADMAP.md` (title line at the top), every file in `manual-tests/`.
- [ ] `.env.example` if it exists; comments inside `.env`; no actual secret values change. _(Owner action: `.env` is gitignored — manually `grep -i paybitty .env` and update any display-name strings.)_
- [x] Branch naming convention — going forward, still `vX.Y.Z/<slug>`, the project name is not in the branch slug.
- [x] Custom domain — if a `paybitty.*` domain was provisioned on Vercel, plan the cutover separately (Pre-deployment Checklist). Not in scope for this branch.

**Strategy**
- [x] Run `grep -ril "paybitty" .` once to inventory every reference. Commit the inventory to the branch description for review, then fix in logical groups (docs / templates / UI copy / code comments).
- [x] Be careful with **partial-word** matches — `PayBitty`, `paybitty`, `PAYBITTY`. A case-insensitive grep will catch them; run each variant through manual review since the replacement (`SatSend`) has a different capitalisation pattern.
- [x] **Historical commits, CHANGELOG entries tagged for prior releases, and git tags** do NOT get rewritten — they document a point-in-time state. Only active/living copy gets updated.

**Tests**
- [x] Typecheck + lint + existing test suite all green (no behavioural changes, so no new tests needed). _(Typecheck clean; vitest 442/442 pass including the new `rename-to-satsend.test.ts` regression guard. The 1 lint error in `columns.tsx:51` is pre-existing on `main` and out of scope.)_
- [ ] Visual smoke: open every major page and confirm no stray "Paybitty" string is visible. _(Owner action.)_
- [ ] Email smoke: publish a test invoice, confirm the subject line and body read "SatSend". _(Owner action.)_

**Done when:** `grep -ril "paybitty" src/ app/ docs/ *.md *.json` returns zero matches (or only intentionally-preserved history entries in `CHANGELOG.md`); the visible product — UI, emails, PDFs, page titles, nav — reads "SatSend" everywhere.

---

### ✅ v1.4.16 — Invoice Number Character Limit

**Branch:** `v1.4.16/invoice-number-char-limit`

**Context:** The invoice number field on the form (`/invoices/new` and `/invoices/[id]/edit`) is currently unbounded. Long values blow out table column widths on `/invoices`, wrap awkwardly on the public invoice page, and produce ugly subject lines in `invoice_published` emails ("Invoice ABCDEFGHIJKLMNOPQRSTUVWXYZ-2026-04-29-FOLLOWUP-V2 from …"). Cap at **30 characters** across the whole pipeline.

**Scope**
- [x] DB-level constraint — migration `0020_invoice_number_length.sql` adds `constraint invoice_number_length check (invoice_number is null or char_length(invoice_number) <= 30)`. Reconciliation policy: **delete** (not truncate) any pre-existing rows over 30 chars — locked during planning since over-length values are realistically only abandoned test data. Self-healing pattern matches `0018`. Verified against remote with `npx supabase db push` BEFORE PR (zero offenders deleted on apply).
- [x] Form-level enforcement — `maxLength={30}` on `<input id="input-invoice-number">` in `src/components/invoice-form.tsx`, plus `assertInvoiceNumberLength` server-side guard called from both `saveDraft` and `updateDraft` in `src/app/(dashboard)/invoices/actions.ts`. Existing soft-validation also lowered from 50 to 30 chars (defensive). Server action throws `Error("invoice_number: ...")` to match the existing field-prefix convention.
- [x] Helper text — live `N / 30` counter rendered under the field in `tabular-nums` muted-foreground style. Updates as the user types.
- [x] Audit display sites — see manual-tests doc `manual-tests/v1.4.16-invoice-number-char-limit.md`. Dashboard cell and public-page heading have no truncation classes; risk is layout pressure, not clipping. Documented as visual checks rather than automated tests.
- [x] **Added during planning:** `duplicateInvoice` was a missed scope item — its old `${source} (copy)` suffix would push duplicates of long-but-legal invoice numbers over 30 chars and trigger the new CHECK. Replaced with `buildDuplicateInvoiceNumber()` which always appends `... (copy)` and trims source from the end only when needed. Result is always ≤ 30 chars when source is ≤ 30.

**Tests**
- [x] Unit/integration test on the server action: passing a 31-char invoice number returns a validation error, 30-char passes, undefined passes (optional). Covers both `saveDraft` and `updateDraft`.
- [x] Form test: typing past 30 characters is blocked by `maxLength`; live counter renders `N / 30` and updates as the user types.
- [x] DB-level test (or manual): inserting a 31-char value via SQL is rejected by the CHECK constraint. (DB-level enforcement covered in manual-tests doc TEST 4 — no automated test for the migration constraint itself.)
- [x] **Added:** `duplicateInvoice` suffix tests — short source no trim, 20-char boundary no trim, 21-char source trims by 1, 30-char source trims to 20.

**Done when:** No code path — UI form, server action, or direct DB insert — accepts an invoice number longer than 30 characters.

---

### ✅ v1.4.17 — Invoices Pagination State Preserved on Navigate-Away

**Branch:** `v1.4.17/invoices-pagination-state`

**Context (bug):** `/invoices` paginates server-side (TanStack `getPaginationRowModel`). If the owner is on page 3 of their invoices, opens an invoice (`/invoices/[id]`), and clicks "← Invoices" to return, the list resets to page 1. They have to navigate forward again to get back to where they were. Same problem if they navigate away and come back via the browser back button or the nav.

**Likely cause:** pagination state lives only in `useState` inside `InvoiceDataTable`. It's never reflected in the URL or persisted across mount/unmount, so the component re-mounts fresh on return. Plus, the `← Invoices` link itself was a hard `<Link href="/invoices">` (not `router.back()`), so even with URL state added, clicking it would still drop the page param.

**Scope**
- [x] Persistence approach chosen: **URL search param (`?page=N`)**. 1-indexed in the URL (user-friendly), 0-indexed internally (TanStack convention). Page 1 = no param (canonical clean URL). `sessionStorage` rejected (not shareable, doesn't survive hard refresh).
- [x] Wired `useSearchParams` + `router.replace` in `data-table.tsx`: initial `pageIndex` parsed via `parsePageParam()`, `onPaginationChange` callback writes URL on every page change. `{ scroll: false }` to avoid scroll-to-top when paging.
- [x] **Out of scope (decided during planning):** persisting global filter, sort, or archive toggle. The bug report is specifically about pagination; those are query operations and reset-on-navigate matches user mental model. One-line additions later if real users complain.
- [x] Clamp effect: if URL or filtering pushes `pageIndex` past `getPageCount() - 1`, reset to last available page. Prevents empty-table flash on `?page=99` and stale page after filtering.
- [x] **Added during planning:** the `← Invoices` link in `[id]/page.tsx:42` was a hard `<Link href="/invoices">` — would drop page state even with URL persistence in place. Replaced with new `BackToInvoices` client component that uses `router.back()` when history exists, falling back to `router.push("/invoices")` for deep-link arrivals (paste URL, email).
- [x] **Added:** wrap `<InvoiceDataTable>` in `<Suspense>` in `page.tsx` — required by Next.js App Router when a client component uses `useSearchParams`.

**Tests**
- [x] Component test: rendering `InvoiceDataTable` with `?page=2` lands on page 2 (verified via row visibility — page-2 rows present, page-1 rows absent).
- [x] Component test: clicking "Next" calls `router.replace("/invoices?page=2", { scroll: false })`.
- [x] Component test: clicking "Previous" from page 2 strips the param entirely (canonical clean URL).
- [x] Component test (parameterized): invalid `?page=` values (`foo`, `0`, `-1`, ``) all default to page 1.
- [x] Component test: `?page=99` (out-of-bounds) clamps to last available page.
- [x] Component test (`back-to-invoices.test.tsx`): `BackToInvoices` calls `router.back()` when `window.history.length > 1`, falls back to `router.push("/invoices")` when history is empty.
- [x] Manual tests: 8 scenarios in `manual-tests/v1.4.17-invoices-pagination-state.md` covering click-back, browser back, hard refresh, direct URL share, out-of-bounds, garbage values, sidebar nav, deep-link back-link.

**Done when:** the dashboard pagination position is preserved across forward-and-back navigation, hard refresh, and direct URL-share, with the URL reflecting the current page.

---

### ✅ v1.4.18 — Resend Webhook: Sent vs Delivered vs Bounced

**Branch:** `v1.4.18/resend-webhook`

**Context:** Today the app conflates "Resend accepted the send request" with "the recipient received the email". When `email_events.status='sent'`, all we actually know is that Resend's API returned success at send-time — the email may still bounce (bad address, full mailbox), be marked as spam, or never reach the inbox at all, and the owner has no signal that anything went wrong. The `/invoices` indicator shipped in v1.4.9 surfaces *send-time* failures (Resend rejected the request); this branch covers *post-acceptance* failures by subscribing to Resend's webhook lifecycle.

This branch closes the gap. After it lands, the **Activity** card distinguishes a "Sent" email (Resend accepted it) from a "Delivered" email (the recipient mailbox confirmed receipt) from a "Bounced" or "Marked as spam" email (post-acceptance failure).

**Schema**
- [x] Migration `0021_resend_webhook_lifecycle.sql`: extends the `email_event_status` enum with `'delivered'`, `'bounced'`, `'complained'`; adds dedicated `email_events_resend_message_id_idx`; adds `webhook_deliveries(svix_id pk, event_type, received_at)` dedupe table.

**Webhook endpoint**
- [x] New route `POST /api/webhooks/resend`.
- [x] Verifies the Svix signature using the `svix` package against `RESEND_WEBHOOK_SECRET`.
- [x] Parses the payload, looks up the `email_events` row by `resend_message_id`, and updates `status` + `updated_at`. For `email.bounced` events, captures `data.bounce.message` in `error_message`.
- [x] **Idempotent** via a real `webhook_deliveries(svix_id pk)` dedupe table (chosen over the lighter "compare-status" short-circuit during planning — gives at-most-once as a DB-enforced invariant). Lifecycle: `queued`/`sent` → `delivered`; `bounced`/`complained` may overwrite `delivered`; no downgrades.
- [x] Returns `2xx` on every recognised payload. Unknown event types (e.g. `email.opened`) return `200` with an `ignored:` body so Resend does not retry.

**UI**
- [x] **Activity card** (`src/app/(dashboard)/invoices/[id]/invoice-activity-card.tsx` — renamed in v1.4.10, the roadmap's `email-activity-card.tsx` reference was stale): widened `EmailEventStatus` to include the three new values; `emailIcon()` now returns a green `MailCheck` for delivered, red `MailX` for bounced, orange `MailWarning` for complained; `emailLabel()` suffixes `sent` rows with `awaiting delivery` to make the transient state visible at a glance; `bounced` rows surface `error_message` in red below the row (same pathway as `failed`).
- [x] **`/invoices` per-row indicator** (`columns.tsx`): widened `last_publish_email_status` type; the failure predicate now triggers on `failed | bounced | complained`; per-status tooltip text via a small mapping.

**Out of scope (deferred)**
- `email.opened` / `email.clicked` events — read-receipt territory, not delivery confirmation. Tracked separately if ever needed.
- Retry / resend UX after a bounce — depends on the deferred "edit `client_email` post-publish + re-send" work.
- Dashboard counters or aggregates ("you have 3 bounced emails this week") — separable from the per-invoice surfacing.

**Tests**
- [x] Webhook: rejects requests with bad signature (401).
- [x] Webhook: rejects requests with missing svix headers (401).
- [x] Webhook: flips `sent → delivered` on `email.delivered`.
- [x] Webhook: flips `sent → bounced` on `email.bounced` and writes `error_message`.
- [x] Webhook: flips `delivered → complained` on `email.complained`.
- [x] Webhook: duplicate `svix-id` is idempotent (no second update; dedupe table returns conflict).
- [x] Webhook: unknown event type returns `200` (not `5xx`) with no DB update.
- [x] Webhook: no matching `email_events` row returns `200` (not `4xx`).
- [x] Webhook: does not downgrade — ignores `delivered` event when row is already `complained`.
- [x] Webhook: allows `complained` to overwrite `delivered` (post-delivery complaint).
- [x] Activity card: renders `delivered` (mail-check), `bounced` (mail-x with error_message), `complained` (mail-warning, "marked as spam") rows.
- [x] Activity card: `sent` row carries the `awaiting delivery` suffix.
- [x] `/invoices` columns: indicator renders for `bounced` (tooltip "Email bounced") and `complained` (tooltip "marked as spam") rows; absent on `delivered` rows.

**Pre-deployment checklist (manual, post-merge)**
- [ ] Add `RESEND_WEBHOOK_SECRET` to Vercel env (production + preview).
- [ ] Configure the webhook endpoint in the Resend dashboard pointing at `https://<your-domain>/api/webhooks/resend`. Subscribe to `email.sent`, `email.delivered`, `email.bounced`, `email.complained`.
- [ ] Smoke test on preview: send a publish email to a known-bouncing address (e.g., `bounce@simulator.amazonses.com`) and confirm the row flips through `sent → bounced` within a few seconds, the activity card updates, and the `/invoices` indicator appears.

**Done when:** an owner can distinguish a "sent" email (Resend accepted) from a "delivered" email (recipient confirmed receipt), and a bounced or spam-marked email is surfaced in both the Email Activity card and the `/invoices` indicator without manual investigation. The README note at `notes:` under "Publish vs Send-via-email split" can be removed.

---

## Developer Enablement (do first — unblocks testing and speeds everything up)

> **Current priority.** This lets the agent write and test features end to end
> (create an invoice, pay it, wait for detection and confirmations, assert the
> result) without the human doing manual testing. Dev-only tooling, never shipped
> to production. Run it before and alongside the hardening train.

### 🔴 v1.4.36 — Test automation harness
**Branch:** `chore/test-automation`

- **Testnet wallet tool** (`test-automation/wallet.mjs`) — done. Derives addresses
  from a testnet seed, locates funds, selects coins, signs, and broadcasts.
- **Harness + runner** (`test-automation/lib.mjs`, `harness.mjs`) — done. Creates a
  test user and published invoices with fresh addresses, pays them, drives the
  app's payment route, waits for confirmations, and asserts the verdict, the
  recorded amounts, and the emails. Proven for `underpaid` (automated, PASS) and
  `paid`/`overpaid` (manually driven).
- **Separate Supabase test project** (`SatSend-dev`) — done. Local development no
  longer shares the production database, which completes the environment half of
  S2.2 and stops the stale production deployment from corrupting test results.
- **Dev-only automation API** — deferred. Not needed for testing (the harness
  writes directly with the service role); fold it into the v2.8 agent API instead.

**Leftover — final action before retiring the test wallet.** The wallet's
spendable balance sits at high address indices that the wallet UI does not display
(the gap limit is ~20). Sweep every remaining testnet fund back to a
wallet-visible low address as the last on-chain action: the visible address is
`m/84'/1'/0'/0/102`; the hidden funds are at indices 300, 500, 1000 and 1001.
Do this on whichever branch is live once no further on-chain tests are needed.

**Done when:** the agent can run a full payment scenario start to finish against a
disposable database and report a pass/fail result, with the human only approving
merges.

### 🟡 v1.4.37 — Schema cleanups (agreed during the test-harness work)

- **`tax_fiat` → computed column.** Keep `tax_percent` as the input and make
  `tax_fiat` `GENERATED ALWAYS AS (round(subtotal_fiat * tax_percent / 100, 2))
  STORED`, so it can never drift. Update the app to stop writing it. Pair with the
  total-consistency CHECK from S4.
- **`invoice_events` completeness.** Add typed `from_status` and `to_status`
  columns (the invoice status type) and log the *automatic* payment transitions
  (payment_detected → paid / underpaid / overpaid) as well as the manual ones the
  feed records today. Typed columns, no JSON blob.
- **`delivery_status`.** Replace the inferred combination of `sent_at` /
  `send_method` / `email_attempted_at` with one explicit `delivery_status` value as
  the authoritative state; keep `sent_at` as the timestamp and let `email_events`
  hold the detailed history. Lower priority than the two above.
- **Surface under/overpaid where the owner actually looks.** Today the overpaid
  state is shown only on the invoice detail page and in the payment-confirmed
  email. The `/invoices` list says just "Paid" and the activity feed records
  nothing, so an owner who never opens the detail page or the email misses it. Add
  a list indicator for under/overpaid, and let the automatic transitions land in
  the feed via the item above.

---

## Security & Hardening Train (from the 2026-07 master audit)

> **Do this whole train before resuming the feature queue below and before any
> mainnet use.** Each item is one branch / one PR, same as any other roadmap
> version. The one-liner here tells you *what and why*; the exact numbered steps
> are in **Appendix A** at the end of this file, and the full findings and
> reasoning behind every item are in **Appendix B**.
>
> **Absorbed items:** the old `⏳ v1.4.19` (Payment Amount Awareness) is folded
> into **v1.4.19-H (S2)**, and the old `⏳ v1.4.28` (Cron strategy) is folded into
> **v1.4.28-H (S3)**. Do NOT do those two separately — their sections further down
> are kept for their detailed spec but are superseded by the -H versions here.

### Phase 0 — Launch blockers (do in this order)

#### ✅ v1.4.19-H (S0) — Green the build
**Branch:** `fix/green-the-build` · Detail: Appendix A → S0
The test suite is red on `main`: 5 tests in `actions.test.ts` fail because a
fixture `due_date` (2026-07-10) is now in the past, and lint exits 1
(`columns.tsx:59`). Freeze time in the test with `vi.setSystemTime`, fix the
display-name lint error. Nothing else proceeds on a red suite.
**Done when:** `npm run test:run`, `npx tsc --noEmit`, `npm run lint` all exit 0.

#### ✅ v1.4.20-H (S1) — Close the four anon database exposures
**Branch:** `fix/rls-critical-exposures` · Detail: Appendix A → S1
Highest priority in the project. Fixed: (1) the `invoice_email_summary` view
leaked all invoices — `set (security_invoker = on)` + revoke anon; (2)
`webhook_deliveries` had RLS off — enabled it, no policies (server-role-only,
by design); (3) the `anon_select_non_draft` policy exposed every non-draft
invoice — dropped it and moved the payer page onto a server-published
**broadcast** channel instead of `postgres_changes` (so no anon table read is
needed); (4) reverted `REPLICA IDENTITY` to `DEFAULT`. Also stripped
`access_code`/`user_id` from the public payload and marked `admin.ts`
`server-only`.

**Deviations from the original spec:**
- The "shrink the realtime publication" step (per-table `publish` restriction
  via `ALTER PUBLICATION ... ADD TABLE ... WITH (publish = ...)`) turned out to
  be invalid Postgres syntax — `publish` is a publication-wide setting, not a
  per-table one. Dropped that step entirely: dropping the anon SELECT policy
  already fully blocks anon from `postgres_changes` regardless of publication
  config, so no publication change was needed to close the exposure.
- Two gaps were found only after the first push of migration `0022` (already
  applied to remote by then), so they shipped as a follow-up migration `0023`
  rather than editing an already-applied file: `realtime.broadcast_changes()`
  sends via `realtime.send()`, which defaults `private = true` — anon needs an
  explicit RLS policy on `realtime.messages` (not `invoices`) to receive
  broadcasts, and the client must open the channel with
  `{ config: { private: true } }`. Added that policy, scoped to the
  `invoice:<uuid>` topic pattern rather than joining back to `invoices` (anon
  can no longer read that table). Also added a guard so the trigger never
  broadcasts for `status = 'draft'` invoices.
- `server-only` was not previously an installed dependency; added it, plus a
  `vitest.config.ts` alias to Next's own no-op build of that package (the same
  alias Next's webpack config uses on the server layer), since Vitest doesn't
  apply Next's RSC bundling-layer separation and would otherwise hit
  `server-only`'s throwing implementation in every test that transitively
  imports `admin.ts`.
- Manual TEST 4 surfaced two more bugs, both fixed in follow-up commits/migrations:
  1. The client subscribed to the private broadcast channel without first
     calling `supabase.realtime.setAuth()` — private channels (which is what
     `realtime.broadcast_changes()` sends by default) are only authorized
     against `realtime.messages` RLS once the socket has a JWT attached, even
     for an anonymous client. Fixed in `use-public-invoice-realtime.ts`.
  2. **More severe:** `broadcast_invoice_status_change()` sets `search_path = ''`
     (correct hardening) but referenced the `invoice_broadcast_record`
     composite type unqualified. With an empty search path Postgres couldn't
     resolve it, so **every non-draft UPDATE to `invoices` threw `42704` and
     aborted the whole transaction** — not just breaking the broadcast, but
     silently blocking every invoice update (mark-as-paid, edits, cron
     sweeps) from the moment `0022` was applied until migration
     `0024_fix_broadcast_type_search_path.sql` qualified the reference as
     `public.invoice_broadcast_record`.

**Done when:** no anon request with the public key can read any invoice, summary,
or webhook row; the payer page still updates live; `supabase db lint` is clean.
Manual test guide: `manual-tests/v1.4.20-H-rls-critical-exposures.md`.

#### ✅ v1.4.19-H (S2) — Payment forgery fix + amount verification (absorbs old v1.4.19)
**Branch:** `v1.4.19/payment-amount-awareness` · Detail: Appendix A → S2
The payment-status API trusted the client's `status:"paid"` claim and checked
no amount, so a 1-sat tx could forge a paid invoice. Fixed: the route now
passes the REAL fetched tx into the shared scheduler (the synthetic tx is
gone), requires the access-code cookie, and both detection callsites
(fast-path route + cron) require a 2-block confirmation depth (computed from
a fetched chain tip, since mempool.space only exposes a confirmed/not-confirmed
flag plus block height) and a fiat-coverage check (5% tolerance) before landing
on `paid`, `underpaid`, or `paid`+`overpaid`.

**Deviation from the original spec (planning discussion, pre-implementation):**
the spec above called for snapshotting `expected_sats` (and the BTC price used)
at **publish** time. That was caught as wrong during planning: locking the sats
target to the publish-time price means a payer who pays the correct fiat amount
later, after BTC has moved, would be wrongly flagged over/underpaid purely
because of price drift the invoice never priced in. Implemented instead: no
publish-time snapshot; the paying tx's sats are converted to fiat using the
BTC price fetched at confirmation time and compared against `total_fiat`. New
columns are `amount_received_sats`, `btc_price_at_detection`,
`amount_received_fiat`, `overpaid` (no `expected_sats` column). If the price
oracle is unavailable when a tx confirms, the verdict is deferred (invoice
stays `payment_detected`) rather than guessed, and retried on the next tick.

**Done when:** a forged-`paid` POST cannot move an invoice past
`payment_detected`; a real but below-tolerance payment lands on `underpaid`;
the amount received and the price used to judge it are persisted; a confirmed
tx below 2-block depth does not finalize a verdict.

#### ✅ v1.4.19.1-H (S2.1) — Restore public invoice live updates
**Branch:** `fix/public-invoice-realtime-authorization` · Detail: Appendix A → S2.1
The public `/invoice/[id]` page was refused access to its private `invoice:<id>`
broadcast channel, so payment status changes only appeared on a refresh. Migration
`0023` wrote the `realtime.messages` policy against the `topic` **column**;
Supabase evaluates it against the **requested** topic, exposed via the
`realtime.topic()` helper, so the predicate never matched. Fixed in migration
`0026_fix_invoice_realtime_policy.sql`, which recreates the policy with
`(select realtime.topic())`.

**Also widened from `to anon` to `to anon, authenticated`:** payers are anonymous,
but an owner previewing their own public link is signed in, and their socket
connects with the `authenticated` role, which the old `to anon` rule did not cover.
No new exposure — the invoice UUID is already the capability for anon, a draft
never broadcasts, and the payload is only `{id, status, btc_txid}`.

**Done when:** a public invoice page logs `SUBSCRIBED`, never logs a
`CHANNEL_ERROR`, and its status changes from a service-role update within about
one second without refreshing the page.
Manual test guide: `manual-tests/v1.4.19.1-H-public-invoice-live-updates.md`.

#### ✅ v1.4.19.2-H (S2.2) — One writer per database (stop cross-version cron writes)
**Branch:** `fix/environment-and-deployment-hygiene` · Detail: Appendix A → S2.2
Resolved, in three parts: (1) local development moved to its own Supabase project
(`SatSend-dev`), so test runs no longer share the production database; (2) the
stale `v1.4.18` production build was replaced by redeploying `main` to Vercel, so
production now runs current code; (3) the sweep route gained a single-writer guard
— it no-ops unless `PAYMENT_SWEEP_ENABLED=true` is set in that environment, so a
stray, test, or future stale deployment cannot sweep a shared database.
**Done when:** only one code version can write to a given database; a fresh local
test invoice is never touched by another environment's cron and its
`paid`/`underpaid` verdict always carries amounts; and production serves the
current branch.
**Note:** the guard must be switched on (`PAYMENT_SWEEP_ENABLED=true`) in whichever
environment owns the sweep (production, or the external scheduler) — see the
pre-deployment checklist and `AGENTS.md`.

#### ✅ v1.4.19.3-H (S2.3) — First controlled real-bitcoin smoke test (mainnet)
**Branch:** `chore/mainnet-smoke-tooling` · Detail: Appendix A → S2.3
The mainnet dry-run had never succeeded and was the highest-risk unverified path in
a Bitcoin product. Done: a real mainnet payment was made to an invoice and the app
detected, confirmed, and judged it correctly.
**Result (2026-10-06):** invoice `MAINNET-SMOKE` for $1, paid 1,169 sats (fee 141
sats) in tx `3424e270…`; after 2 confirmations it landed on `paid` with
`amount_received_sats=1169`, `btc_price_at_detection=85587`,
`amount_received_fiat=1.0005`, `overpaid=false`.
Tooling: `test-automation/mainnet-smoke.mjs`, with the shared library made
network-aware. Prereqs were: S2 merged; S2.2 done; a real receive address;
`NEXT_PUBLIC_BTC_NETWORK=mainnet`; a tiny amount; the payer page open (the cron is
not per-minute yet).

#### ✅ v1.4.28-H (S3) — Restore sub-daily detection (absorbs old v1.4.28)
**Branch:** `v1.4.28/cron-strategy` · Detail: Appendix A → S3
Shipped: `.github/workflows/payment-sweep.yml` drives `/api/cron/payment-sweep`
every ~5 min (GitHub Actions' minimum; Vercel Hobby's own cron stays as a daily
placeholder). The schedule is now time-based — anchored on `published_at`
(pre-mempool) and `mempool_seen_at` (post-mempool) — so a late or missed tick
lands on the correct boundary instead of burning a stage. The sweep orders by
`next_check_at`, includes `overdue` (M-DB-2), drains the due queue past one batch,
and sets `maxDuration = 60`. New column `published_at` (migration `0028`).
**Verified:** unit + route tests; the production workflow returned a green run
(2026-10-06); and a real testnet4 payment was detected end-to-end against the
local test database (`manual-tests/v1.4.22-H-testnet-detection-e2e.md`) — the
`pending → payment_detected` hard gate passed. Still unrun as one combination: a
real payment detected by the external scheduler against production.

#### ✅ v1.4.21-H (S4) — DB defends money state
**Branch:** `fix/db-money-invariants` · Detail: Appendix A → S4
Migration `0027_money_invariants.sql`: CHECK constraints (amounts >= 0, tax
percent 0-100, currency USD, totals consistent, line_items shape) added NOT VALID
then validated; a trigger freezing a paid / mid-payment invoice's money and payment
fields; a delete-guard trigger allowing only drafts. Code: `bulkDelete` is now
draft-only to match. Verified on the test database: a paid invoice's total cannot
be changed, a non-draft cannot be deleted, a negative or inconsistent total is
rejected, and a benign update on a paid invoice (the detection flow) still works.
**Done when:** a PATCH to a paid invoice's total is rejected by the DB, non-draft
deletes are rejected, and negative/inconsistent amounts cannot be written. ✅

> **END OF PHASE 0 = safe for mainnet.** A first **controlled real-bitcoin smoke
> test (S2.3)** runs earlier, right after S2.2, on a deliberately tiny amount — so
> real mainnet exposure is validated while S3/S4 continue. Full mainnet readiness
> still requires all of Phase 0. The phase-end check is the same flow repeated
> through the external cron once S3 lands; the detection logic behind that path is
> now verified end-to-end on testnet4
> (`manual-tests/v1.4.22-H-testnet-detection-e2e.md`), so the remaining gap is only
> the mainnet-plus-scheduler combination itself.

### Phase 1 — Correctness & hygiene (before real volume)

Each is one branch. Detail for all of these: Appendix A → Phase 1.

- ✅ **v1.4.22-H — Detection robustness (server side)** (`v1.4.22-H/detection-robustness`):
  shipped — cron CAS checks `.select("id")` before sending email (no duplicate
  emails); `markUnpaid`/`bulkUnarchive` reset the schedule columns + clear
  `btc_txid`; `fetchAddressTxs` returns `null` on failure (outage ≠ "no tx") with
  `AbortSignal.timeout`, and the sweep skips without burning an attempt; the
  scheduler prefers a confirmed / amount-matching tx; the freshness check fails
  closed; bounded (1h) revert-to-pending when a seen tx vanishes (M-MONEY-4
  remainder). **Split out:** the `payment-watcher.tsx` mempool.space WebSocket
  reconnect (the fastest-path client socket) is now its own branch,
  `v1.4.22-H/ws-reconnect`.
- ✅ **v1.4.23-H — RLS & indexes** (`v1.4.23-H/rls-and-indexes`): shipped —
  `pre_archive_status` → `invoice_status` enum + CHECK (legacy values nulled);
  the summary view recreated with enumerated columns (`security_invoker` + the
  anon revoke re-asserted); `invoices (user_id, created_at desc)` index +
  `auth.uid()` wrapped in all three policies; webhook dedupe now treats only
  `23505` as a duplicate, releases the claim on failure so Svix can retry, and
  sweeps 30-day-old rows; `email_events.updated_at` owned by a trigger. Un-archive
  reports a legacy row it cannot restore instead of guessing.
  **Split out:** `(user_id, invoice_number)` uniqueness — prod already has 8
  duplicate groups (`development/invoice-number-duplicates-audit.md`), so the
  constraint would fail the migration. The generator bug that created them
  (`buildDuplicateInvoiceNumber` used a fixed suffix) **is fixed here**.
- 🔴 **v1.4.23.1-H — Invoice-number uniqueness** (`v1.4.23.1-H/invoice-number-uniqueness`):
  the split-out follow-up. Start from the audit listing in
  `development/invoice-number-duplicates-audit.md`; decide per group (delete /
  archive your test rows, rename the later copy for real users, never the
  original); then add the partial unique index
  `(user_id, invoice_number) where invoice_number is not null` plus a
  `check (invoice_number <> '')`, and a friendly `23505` message on the create /
  publish path.
- 🔴 **v1.4.24-H — Proxy & boundaries** (`v1.4.24-H/proxy-and-boundaries`):
  `proxyConfig` → `config`; add `error.tsx` / `not-found.tsx` / `loading.tsx`;
  proxy `getSession` → `getUser`; security headers in `next.config.ts`.
- 🔴 **v1.4.25-H — Public-endpoint hardening** (`v1.4.25-H/public-endpoint-hardening`):
  access-code check on the public PDF route; cap `line_items` length + cache PDF;
  `btc-price` currency allowlist; `timingSafeEqual` for `CRON_SECRET`; `secure`
  cookie flag.
- 🔴 **v1.4.26-H — Rate limiting & abuse** (`v1.4.26-H/rate-limiting`): Vercel WAF
  rate-limit rules on access-code verify / email send / PDF route; server-side
  `client_email` validation; per-user daily send cap; minimum access-code length +
  hashed storage.

### Phase 2 — Structural single-sources-of-truth

Each is one branch. Detail: Appendix A → Phase 2.

- ⏳ **v1.4.27-H — Generate Supabase types** (`chore/supabase-types`): generate
  `database.types.ts`, thread `Database` through the three client factories, delete
  the four hand-declared row shapes.
- ⏳ **v1.4.29-H — Zod + typed action results** (`refactor/zod-validation`): one
  shared `invoiceSchema` for form + actions; convert thrown-string validation
  errors to `{ ok, field, message }` return values; collapse the form's three
  parallel arrays into one.
- ⏳ **v1.4.30-H — Realtime & styling unification** (`refactor/realtime-and-styling`):
  one `useInvoiceChannel` hook with bounded resubscribe; document the 1-conf reorg
  risk; pick one color source of truth (do the styling half during v1.5).
- ⏳ **v1.4.31-H — Integration test layer** (`test/supabase-integration`): the
  PRD-promised suite against a real Supabase instance, starting with
  address-uniqueness (fix the cross-tenant oracle here via a `security definer`
  boolean RPC) and status transitions.

### Roadmap & docs housekeeping (do alongside Phase 0)

- ⏳ **v1.4.32-H — Roadmap/docs restructure** (`chore/roadmap-restructure`): split
  completed sections into `ROADMAP-ARCHIVE.md`; add `OUTSTANDING-VERIFICATIONS.md`
  + `manual-tests/README.md`; banner `PRD.md` as historical + finish the SatSend
  rename; add `.env.example`; set `package.json` to `1.4.18` + backfill git tags;
  `git rm --cached` the `.DS_Store` files; delete the stale `master` branch. Detail:
  Appendix A → "Roadmap & docs restructure".
- ⏳ **v1.4.33-H — Claude workflow hooks/skills** (`chore/claude-hooks`): add the
  test-must-pass commit gate, typecheck-on-Stop, version-sync-on-PR, and roadmap-size
  hooks; add the pre-merge-verification, migration-safety, and deploy-checklist
  skills. Detail: Appendix A → "Claude Code workflow".

### Phase 3 — Redesign, then the feature queue resumes

Once Phase 0 and Phase 1 are green (the tech works), do **v1.5 (Full Site
Redesign)** first — the design direction is locked and the brand handoff is in the
repo, so it should not wait behind the entire feature queue. Then resume the ⏳
feature items below in order (v1.4.20 auto-overdue emails onward). They are
unchanged by the audit. Note again that the old v1.4.19 and v1.4.28 sections are
**superseded** by v1.4.19-H and v1.4.28-H above — keep them for reference but do
not re-implement.

---

### ⏳ v1.4.19 — Payment Amount Awareness (Under / Overpayment) — SUPERSEDED by v1.4.19-H (S2)

> **Superseded:** implement this as part of **v1.4.19-H (S2)** in the hardening
> train above, which adds the forgery fix and amount verification on top of this
> spec. This section is kept for its detailed schema/test spec only.

**Branch:** `v1.4.19/payment-amount-awareness`

**Context:** Today the on-chain detector flips an invoice to `paid` the moment it sees *any* tx at the address. It does not compare amount to invoice total. Two real failure modes follow: a payer sends less than billed (BTC price moved between invoicing and payment, or they fat-fingered) and the invoice is marked fully paid; or they overpay and the surplus is silently absorbed into the "paid" state. This branch closes both gaps for single-payment invoices, denominating in fiat with BTC as the rail and a 5% under/over tolerance.

Decisions locked during v1.4.10 planning:
- **Invoices remain fiat-denominated.** `total_fiat` + `currency` is the source of truth. BTC price at the moment of detection (mempool.space + Coinbase API) converts received sats to fiat for the comparison.
- **5% tolerance, both sides.** `coverage = received_fiat / total_fiat`. `< 0.95` → underpaid; `0.95 ≤ x ≤ 1.05` → paid (clean); `> 1.05` → paid + overpaid flag. The 5% band is wide enough to absorb dust and small price wobble; tunable later.
- **`underpaid` is its own status.** Mirrors the existing `paid` / `overdue` enum values. Owners can manually flip an underpaid invoice to paid (e.g., they took the rest in fiat off-platform) via the Mark As menu shipped in v1.4.10.
- **`overpaid` is a flag, not a status.** The invoice is paid; it is also overpaid. UI surfaces the surplus as a small indicator alongside the status badge.
- **Single-payment-only.** Multi-payment-toward-total and the multi-rail `invoice_payments` table are explicitly deferred; v1.4.12's fresh-address rule forecloses multi-payment by definition (any second tx lands on an address that now has prior on-chain history).

**Schema — new migration `supabase/migrations/00XX_payment_amount_awareness.sql`**

```sql
alter type invoice_status add value if not exists 'underpaid';

alter table invoices add column amount_received_sats bigint;
alter table invoices add column btc_price_at_detection numeric;     -- USD per BTC at detection time
alter table invoices add column amount_received_fiat numeric;        -- = amount_received_sats × btc_price_at_detection / 1e8
alter table invoices add column overpaid boolean not null default false;
```

No backfill — existing invoices keep their current `paid` status with NULLs in the new columns. The new logic only applies to detections going forward.

**Detection wiring**
- [ ] On every detection callsite (currently `src/app/api/invoices/[id]/payment-status/route.ts` and `src/app/api/cron/payment-sweep/route.ts`), replace the unconditional `status='paid'` write with a `decidePaymentOutcome(receivedSats, totalFiat, btcPrice)` pure function that returns `{ status: 'paid' | 'underpaid', overpaid: boolean }`.
- [ ] Add `src/lib/btc-price.ts` — fetches the current BTC/USD spot price from Coinbase (`GET https://api.coinbase.com/v2/exchange-rates?currency=BTC`). Used at detection time only. Cache for 60s in-memory to avoid hammering on cron sweeps.
- [ ] If the price oracle fails, **do not flip status**. Schedule a retry on the next cron tick. Log a `[btc-price] oracle unavailable, deferring detection for invoice <id>`. Do not fall back to a stale price; an incorrect status is worse than a delayed one.
- [ ] Persist `amount_received_sats`, `btc_price_at_detection`, `amount_received_fiat`, `overpaid` alongside the status flip in the same UPDATE.

**UI**
- [ ] Status badge: add an `underpaid` variant (amber/red, "Underpaid").
- [ ] Detail page: when `overpaid=true` (regardless of `paid` / `underpaid` status), show a small "Overpaid by $X (Y%)" indicator next to the status badge. When `underpaid`, show "Received $X of $Y (Z%)" inline below the badge.
- [ ] `/invoices` list: extend the status-column filters to include `underpaid`.
- [ ] Mark As menu (v1.4.10): include `underpaid` in `UNPAID_STATES`-equivalent set so the owner can flip an underpaid invoice to paid (manual override) or back to pending. Decision: leaving `underpaid → unpaid` semantics the same as today (clears to pending; address is now tainted by the prior on-chain tx, so re-publish would be blocked by v1.4.12's freshness check — owner is expected to issue a new invoice with a fresh address).

**Email templates**
- [ ] `payment_detected` email: include the actual amount received and the invoice total. If underpaid, the subject line and body explicitly call it out ("Partial payment received: $X of $Y").
- [ ] `payment_confirmed` email: same — include amount + overpaid surplus if applicable.

**Tests**
- [ ] `decidePaymentOutcome`: 90% coverage → `{ status: 'underpaid', overpaid: false }`.
- [ ] `decidePaymentOutcome`: 100% coverage → `{ status: 'paid', overpaid: false }`.
- [ ] `decidePaymentOutcome`: 95.0% (lower bound) → `paid`, no overpaid.
- [ ] `decidePaymentOutcome`: 105.0% (upper bound) → `paid`, no overpaid.
- [ ] `decidePaymentOutcome`: 110% coverage → `{ status: 'paid', overpaid: true }`.
- [ ] Detection happy path: paid amount lands on `paid` status with the amount columns populated and `overpaid=false`.
- [ ] Detection underpaid path: tx for 80% of total → status flips to `underpaid`; amount columns reflect what landed.
- [ ] Detection overpaid path: tx for 120% → status `paid`, `overpaid=true`, amount columns populated.
- [ ] Oracle-down path: Coinbase mock returns 5xx → detector defers (status stays in prior state, e.g. `pending` / `payment_detected`); next cron tick retries.
- [ ] Mark As menu shows the right items on an `underpaid` invoice (Paid + Overdue, no Unpaid since it's already in an unpaid-equivalent state — TBD in implementation, depending on how the menu's `UNPAID_STATES` set evolves).

**Out of scope (deferred to later branches)**
- Multi-payment toward a single invoice total (would foreclose v1.4.12's freshness rule). Revisit if real users hit the use case.
- `invoice_payments` table — the unifying multi-rail architecture sketched during v1.4.10 planning. Stays deferred until multi-payment or programmatic fiat reconciliation is needed.
- Programmatic fiat reconciliation (auto-detecting Stripe / bank-transfer payments). For now, the owner manually flips underpaid → paid via the Mark As menu when fiat tops up the balance off-platform — covered by v1.4.10's existing menu.
- Refund flows for overpaid invoices (out-of-band; the surface only flags it).
- Multi-currency support beyond the per-invoice `currency` field (v2.12 territory).

**Done when:** A BTC payment of any size resolves to one of `paid` / `paid+overpaid` / `underpaid` based on a 5% tolerance band against the invoice's fiat total at detection time; the actual amount received and the BTC price used for conversion are persisted on the invoice row; the UI surfaces both states clearly; the price-oracle failure mode does not corrupt status.

---

### ⏳ v1.4.20 — Auto Overdue Email Notifications

**Branch:** `v1.4.20/overdue-email-notifications`

**Context:** v1.4.11 made the `pending → overdue` transition automatic (via cron + at publish time) but explicitly deferred the email side: the owner only finds out on the next dashboard load. v1.4.20 closes that loop by sending two emails on the auto-flip — one to the owner, one to the client (where a `client_email` exists).

**Scope**
- [ ] New email template `payment_overdue_owner` — sent to the owner on every auto-flip from `pending → overdue`. Subject line and copy similar to the existing `payment_detected` template (sender, client, amount, currency, link to invoice). Idempotent: only fires on the actual transition write, not on every cron tick.
- [ ] New email template `payment_overdue_client` — sent to the client on every auto-flip when `client_email` is non-null. Subject: "Reminder: invoice {INV-N} from {sender} is past due". Body emphasises the invoice link, total, and original due date — non-aggressive tone (this is the first nudge, not a dunning notice).
- [ ] Wire dispatch into `sweepOverdue` (in `/api/cron/payment-sweep/route.ts`) and into the synchronous publish-time path in `applyPublishUpdate` (in `src/app/(dashboard)/invoices/actions.ts`) — both are state-transition write sites where the flip happens. Use the same `safeSend` deduplication strategy already used for `payment_detected` / `payment_confirmed` so the email cannot fire twice for the same row even if both sites flip in quick succession.
- [ ] Suppress on `markOverdue` (manual flip) — the owner triggered it, so they don't need notifying; client notification on manual flip is a separate UX call deferred to a later branch.
- [ ] Surface delivery in the existing Activity feed (`invoice_events` records `marked_as_overdue` already; add a corresponding `email_events` row via the existing `safeSend` pipeline so the activity card shows the send attempt).

**Tests**
- [ ] Cron-side: past-due pending invoice flips to overdue → both `payment_overdue_owner` and `payment_overdue_client` are dispatched exactly once, with the right `to`, `senderName`, `clientName`, `totalFiat`, `currency`, `dueDate`.
- [ ] Cron-side: past-due pending invoice with `client_email = null` → only owner email fires.
- [ ] Cron-side: row that does not flip (future / today / no due date) → no overdue email fires.
- [ ] Publish-time: publishing a draft with a past due date → flips to overdue AND fires both emails (single transition, single send).
- [ ] Manual `markOverdue` → no overdue email fires (owner-initiated, suppressed).
- [ ] Idempotency: a hypothetical second cron tick on the same row (status already `overdue`) → no duplicate email.

**Out of scope**
- Configurable cadence (e.g. "remind again 7 days after due"). v1.4.20 is one nudge per transition; recurring dunning is a future branch.
- SMS / WhatsApp client reminders.
- Per-owner email-template customisation.

**Done when:** When the cron or the publish-time path flips an invoice from `pending` to `overdue`, the owner gets a notification email and the client gets a reminder email (where `client_email` is set), with no duplicates and no email when the owner manually marks the invoice overdue.

---

### ⏳ v1.4.21 — Watcher mount-time GET de-duplication (deferred from v1.4.13)

**Branch:** `v1.4.21/watcher-mount-dedup` (or fold into another branch that touches `payment-watcher.tsx` — e.g. v1.4.19's payment-amount work, where the watcher will be modified anyway).

**Context:** During v1.4.13.7 manual testing, TEST 12 (window-shopper + WS death = total polling silence) consistently showed **two** GETs to `mempool.space/.../api/address/<addr>/txs` instead of the expected one — first at page load, then a second one ~60–90 s later. Visibility-driven `router.refresh()` (in `usePublicInvoiceRealtime`) and dev-mode HMR / Fast Refresh are both plausible causes, but we never confirmed which. The watcher's `useEffect` mount runs `checkRestAndUpdate()` unconditionally; if the effect ever tears down and re-runs (HMR re-mount, or any prop reference change that we missed), the mount-time GET fires again.

This is benign in production for low traffic — at most one extra GET per accidental re-mount, and re-mounts in production are rare. It becomes a real cost driver only at scale (many concurrent window-shoppers + flaky network triggering frequent re-mounts).

**Scope**
- [ ] Reproduce against a production build (`npm run build && npm run start` + manual cron loop) to confirm whether this is purely dev-mode HMR noise or a real production-shipping bug.
- [ ] If it reproduces in production: gate the mount-time `checkRestAndUpdate()` on a per-`(invoiceId, btcAddress)` "already-fetched-this-session" guard — a `useRef` initialised to `false` flipped to `true` after the first GET. Re-mounts skip; deps changes that swap address (theoretical, can't actually happen for an invoice) reset.
- [ ] Alternative if (and only if) the diagnosis is a deps-stability bug: fix the unstable dep at its source rather than papering over with a guard.
- [ ] Update `manual-tests/v1.4.13-payment-detection-latency.md` TEST 12 expectations once the diagnosis is confirmed (currently relaxed to "approximately 1, possibly 2-3 in dev with HMR").

**Tests**
- [ ] Unit test against `PaymentWatcher`: re-rendering the parent does not trigger a second `fetchAddressTxs` call.
- [ ] Manual: production build + window-shopper scenario for 5+ minutes shows exactly one GET.

**Out of scope**
- Any change to the active alongside-WS poll or its phased schedule.
- Any change to the WebSocket lifecycle.

**Done when:** TEST 12 in `manual-tests/v1.4.13-payment-detection-latency.md` reliably shows exactly one mount-time GET in a production build, with the diagnosis (HMR-only vs real bug) documented in the CHANGELOG.

---

### ⏳ v1.4.22 — Activity Feed Completeness: Publish Event + Delivery-Status Deduplication

**Branch:** `v1.4.22/activity-feed-completeness`

**Context:** Two related Activity-feed gaps surfaced after v1.4.10 unified email + manual events into a single feed:

1. **Publish-only path produces no activity entry.** `publishInvoice` in `src/app/(dashboard)/invoices/actions.ts` (line 266) calls `applyPublishUpdate(supabase, invoice, {})` and returns. `applyPublishUpdate` only logs an `invoice_event` when the row flips straight to `overdue` (synchronous overdue-on-publish, v1.4.11). Otherwise no event is written. So if an owner picks "Publish only (don't send yet)" from the publish menu, nothing appears in the Activity card — the invoice transitions from `draft` → `pending` silently. This is asymmetric with `publishAndSendEmail` (writes an `invoice_published` email_event via the email pipeline) and `publishAndMarkSent` (writes a `marked_as_sent` invoice_event), both of which DO produce activity entries.

2. **`invoice-actions--delivery-status` duplicates the activity feed.** `src/app/(dashboard)/invoices/[id]/invoice-actions.tsx` (lines 76–107) renders a `deliveryLine` paragraph above the action buttons whenever `invoice.sent_at` is set: either *"Sent via email on {date}"* or *"Marked as sent on {date}"*. The same information is already in the Activity card directly below — as either the `invoice_published` email_event row (email path) or the `marked_as_sent` invoice_event row (manual mark-sent path). Single source of truth should be the Activity feed; the inline status line is redundant.

After auditing `invoice-actions.tsx` and `page.tsx` on the dashboard detail page, the `deliveryLine` is the only inline status indicator that shadows the Activity card. The status *badge* (top-right of the page) is current state, not historical, and is not duplication. No other activity-shadowing strings exist — only `deliveryLine` needs removing.

**Scope**

- [ ] Define a new `invoice_event` event type — proposed name `published` (compact and matches the existing `marked_as_*` pattern's verb form) or `marked_as_published` (verbose but parallel). Add it to:
  - The `invoice_events.event_type` enum/check constraint in a new migration (`supabase/migrations/00XX_invoice_event_type_published.sql`).
  - The `InvoiceEventType` union and `MANUAL_EVENT_LABEL` map in `src/app/(dashboard)/invoices/[id]/invoice-activity-card.tsx`.
  - The `manualIcon` switch in the same file (suggest `Send` icon or a new `Upload` / `FileCheck` lucide icon — pick one that's visually distinct from `Send` which is already used for `marked_as_sent`).
- [ ] Wire `logInvoiceEvent({ eventType: "published" })` (or whatever the type ends up named) into:
  - `publishInvoice` (publish-only path) — adds the missing entry.
  - **Decision needed at implementation time:** whether to *also* log it from `publishAndSendEmail` and `publishAndMarkSent`. Risk of over-noise: those paths already produce email/manual events that imply publish. Recommendation: **don't double-log** — only the publish-only path writes the new event; the other two already have their distinctive entries. Document this in the new event type's comment.
- [ ] Remove the `deliveryLine` block from `invoice-actions.tsx` (lines 76–81 + the JSX at lines 103–107). Drop the now-unused `format` import if no other call site needs it on this file.
- [ ] Audit the `Invoice` interface in `invoice-actions.tsx` (lines 23–31): `sent_at`, `send_method`, `email_attempted_at` may all become unused props. Remove from the interface and the parent `page.tsx` invoice-fetch projection if so. Be careful — `allSendActionsDone` and `canShowPublishMenu` (lines 45–46) still need `sent_at` and `email_attempted_at` for menu-visibility logic, so those stay.

**Tests**

- [ ] New unit test in `src/app/(dashboard)/invoices/actions.test.ts`: `publishInvoice` calls `logInvoiceEvent` exactly once with the new `published` event type, with the right `invoiceId` and `userId`.
- [ ] New unit test: `publishAndSendEmail` does NOT log a `published` invoice_event (the email_event covers the publish signal).
- [ ] New unit test: `publishAndMarkSent` does NOT log a `published` invoice_event (the existing `marked_as_sent` covers it).
- [ ] Update `invoice-activity-card.test.tsx` to render the new event type and assert label + icon.
- [ ] Update `invoice-actions.test.tsx` if any test asserts presence of `id="invoice-actions--delivery-status"` — remove those assertions; add a regression test asserting the element is **not** rendered even when `sent_at` is set.

**Documentation**

- [ ] `CHANGELOG.md` — new v1.4.22 section describing both changes and the rationale.
- [ ] `README.md` — if any prose references the delivery-status line or asserts that `publishInvoice` is silent, update accordingly. Search for `delivery-status`, `Sent via email`, and `Marked as sent on` to find candidates. The "Email Activity card" terminology in the README (which was renamed to "Activity card" in v1.4.10) should also be re-scanned for staleness.
- [ ] Re-run TEST 9 in `manual-tests/v1.4.12-btc-address-hardening.md` and any `manual-tests/v1.4.10-*` doc to confirm assertions about activity-feed contents still hold post-change.

**Manual verification**

- [ ] On a fresh draft, click "Publish only (don't send yet)" → Activity card immediately shows a *Published* (or chosen label) row with the current timestamp.
- [ ] On the same row, the inline "Sent via email on …" / "Marked as sent on …" line above the action buttons is **gone** for all three publish paths.
- [ ] After clicking "Mark as Sent" on a pending invoice, only one Activity entry appears for that action (the existing `marked_as_sent` row), not duplicated.

**Out of scope**

- Adding `invoice_event` rows for state transitions like `pending → payment_detected` or `payment_detected → paid`. Those are already represented by email_events (`payment_detected`, `payment_confirmed`) in the Activity card. v1.4.22 is targeted at closing the *publish*-side gap and removing the *delivery-status* duplication — not a full "every state transition gets an invoice_event" rebuild.
- Changing the visual treatment of the Activity card itself (rendering, ordering, filtering). UX redesign is owned by v1.5 (Design System Overhaul).

**Done when:** Clicking "Publish only" on a draft writes an Activity entry and the inline `invoice-actions--delivery-status` line is gone, with no other activity-card duplication remaining anywhere on `/invoices/[id]`. Tests, CHANGELOG, README, and any affected manual-test docs are updated.

---

### ⏳ v1.4.23 — Marketing Landing Page

**Branch:** `v1.4.23/marketing-landing-page`

> **Sequencing note:** Should land **after** v1.4.15 (rename to SatSend) so the page is branded correctly from the start. Should land **before** v1.5 (design-system overhaul) so the colour-scheme decision applies to the marketing page too. Slot inside the v1.4 train rather than v1.5 because the page is launch-blocking: the root URL needs to render something purposeful to first-time visitors.

**Context:** The product currently has no marketing page. Hitting `/` (unauthenticated) lands users on whatever the App Router default is, which is not designed to convert. v1 launches as a bitcoin-only invoicing product and that positioning needs a real surface to live on. This branch builds that surface and propagates the same positioning to all non-app touch points (page metadata, OpenGraph, README).

**Scope**
- [ ] Build a public landing page at `/` (or wherever the unauthenticated root currently routes) for first-time visitors. Pitch: "Bitcoin-only invoicing for freelancers". Sections: hero with one-line value prop and CTA, three-to-five product highlights (publish a bitcoin invoice in seconds; live BTC/fiat conversion at view time; on-chain payment detection; no fiat rails to set up; you keep your own keys), a short "How it works" walkthrough (1-2-3 steps), and a sign-in / sign-up CTA at the bottom.
- [ ] Authenticated users hitting `/` should redirect to `/invoices` (or the existing dashboard route), not see the marketing page. Detect via the existing auth helper.
- [ ] Page metadata: `src/app/layout.tsx` (or per-route metadata if the marketing page has its own layout) — `title`, `description`, `openGraph.title`, `openGraph.description`, `openGraph.images`. All copy reads as bitcoin-only positioning.
- [ ] `README.md` — top-of-file description matches the new positioning. Reuse the hero copy where appropriate.
- [ ] OpenGraph image — generate one (Vercel OG image route is the simplest path) that includes the SatSend wordmark, a "Bitcoin-only invoicing" tagline, and a visual cue (small QR or BTC sigil). Wire it into `openGraph.images` so social previews render correctly.
- [ ] Audit existing copy for any non-bitcoin-only positioning that survived v1.4.14: `grep -ri "accept bitcoin\|fiat payment\|pay with" src/` and any `*.md` files. Update or remove.
- [ ] No newsletter signup, no analytics beyond what's already wired, no third-party form embeds. Keep the page tight.

**Tests**
- [ ] Page renders with no auth: hero copy is present.
- [ ] Authenticated request to `/` redirects to the dashboard route (snapshot the redirect target).
- [ ] Metadata snapshot: `title` and `openGraph.title` contain "SatSend" and "bitcoin".
- [ ] Manual smoke: open the page in dev, confirm visual hierarchy and CTA functionality.

**Out of scope**
- Pricing page, blog, docs site, FAQ — none of these exist for v1 launch.
- A/B testing infrastructure — premature. One landing page, one variant.
- Analytics integration beyond what's already in the app.
- Custom illustrations or paid imagery — use simple typography and subtle background treatments. Polish can land in v1.5 with the design-system overhaul.

**Done when:** The unauthenticated root URL renders a purposeful landing page that pitches the product as bitcoin-only invoicing; all metadata, OpenGraph, and README copy reflect the same positioning; authenticated users skip the page; no copy anywhere in the codebase contradicts the bitcoin-only positioning.

---

### ⏳ v1.4.24 — `/invoices` Row Actions: Disable Unavailable Actions with Hover Explanation

**Branch:** `v1.4.24/row-actions-disabled-with-tooltip`

**Context (bug):** From `/invoices`, the row-action menu lets the owner trigger publish, publish-and-send-email, publish-and-mark-sent, etc. on any invoice — including drafts that don't satisfy the action's preconditions (e.g. a draft with no `btc_address`, which v1.4.14 made mandatory at publish time). When that happens, the action **fails silently from the list** — the server action throws, the dropdown closes, and the user sees nothing happen. Same scenario on the edit page (`/invoices/[id]/edit`) is handled correctly: the publish button surfaces a field-level error and scrolls the field into view via the `parseServerError` plumbing.

The list already has one example of the right pattern: **"Send via email"** is greyed out when `client_email` is missing. We need to extend that pattern to cover every precondition, and add a hover tooltip so the user knows *why* an action is disabled. Reuse the **exact wording** shown on the edit page so the user sees consistent language across surfaces.

**Scope**
- [ ] Audit every row action exposed from `/invoices` and identify each precondition. Starter list:
  - Publish (any variant) → requires `btc_address` (drafts only).
  - Publish-and-send-email → also requires `client_email`.
  - Mark-paid → requires status ∈ {pending, overdue, underpaid (post-v1.4.19)}.
  - Mark-unpaid → requires status='paid'.
  - Delete-draft → requires status='draft'.
  - (Confirm: archive, duplicate, mark-overdue — likely no preconditions but worth a sweep.)
- [ ] Centralise availability into a single helper, `getRowActionAvailability(invoice): Record<ActionName, { ok: true } | { ok: false, reason: string }>`. The closest existing pattern is `canPublishInvoice` in `src/lib/invoices/can-publish.ts` — extend that or factor a new sibling, and **make `canPublishInvoice` consume the same source of truth** so the edit-page error wording and the list-tooltip wording are guaranteed to stay in sync.
- [ ] In the row-action menu (likely a `RowActions` component referenced from `src/app/(dashboard)/invoices/columns.tsx`), pipe the per-action `reason` into the menu item: `disabled={!availability.ok}` plus a `<Tooltip>` (shadcn/ui Tooltip if installed; else inline `title=`) showing `availability.reason`.
- [ ] Unify the existing "Send via email when no `client_email`" disable path through the same helper — don't keep two implementations.

**Tests**
- [ ] Unit on `getRowActionAvailability`: for each action × each missing-precondition, returns `{ ok: false, reason: "<edit-page wording>" }`. Asserts wording matches the constants/messages used by `canPublishInvoice` so a future copy change in one place updates both.
- [ ] Component on the row-action menu: a draft with no `btc_address` renders **Publish** disabled with a tooltip whose text matches the edit-page error wording.
- [ ] Component: a paid invoice renders **Mark as Paid** disabled, **Mark as Unpaid** enabled.
- [ ] Component: a draft with no `client_email` renders **Send via email** disabled (regression guard for the existing behaviour, now routed through the new helper).

**Done when:** No action in the `/invoices` row menu can be executed against an invoice that doesn't satisfy its preconditions; disabled actions surface a hover tooltip explaining the missing prerequisite, with wording consistent with the edit page; the "send via email when no client_email" behaviour is unified through the same helper rather than living as a one-off.

---

### ⏳ v1.4.25 — Duplicate Invoice: No Phantom Draft, No `NEXT_REDIRECT` Dialog

**Branch:** `v1.4.25/duplicate-invoice-cleanup`

**Context (two coupled bugs from `/invoices` duplicate action):**

1. **Phantom drafts.** `duplicateInvoice` (`src/app/(dashboard)/invoices/actions.ts:406`) writes a draft row to the DB before redirecting to `/invoices/<new-id>/edit`. If the user clicks Cancel without saving, the row stays — leaving litter on the dashboard list. Expected: the source's data should be passed to `/invoices/new` and only persist when the user clicks Save / Publish / etc.
2. **`NEXT_REDIRECT` error dialog flashes** during the duplicate action even though the redirect itself works. This is the standard Next.js Server-Action `redirect()` semantics — the throw is meant to be caught silently by the framework, but something in the row-action handler or a global error boundary is surfacing it. Likely auto-fixes when item 1 lands, since the new flow uses a client-side `router.push` rather than a server-side `redirect()`.

**Scope**
- [ ] Refactor: `duplicateInvoice` no longer INSERTs. Recommended shape — `/invoices/new?from=<source-id>` query param. The new-invoice page server-loads the source (with auth check), passes its sanitised fields as `initialValues` to the existing `<InvoiceForm>`, no server action involved. Sanitisation matches the old action: `btc_address=null`, `btc_txid=null`, `status='draft'`, `invoice_number` via `buildDuplicateInvoiceNumber()` (already constraint-safe per v1.4.16).
- [ ] Row-action handler in `/invoices` swaps `duplicateInvoice(id)` for a client-side `router.push('/invoices/new?from=<id>')`.
- [ ] Verify the `NEXT_REDIRECT` dialog is gone. If anything else still surfaces it (e.g. a global toast), filter via `isRedirectError(e)` from `next/navigation`.

**Tests**
- [ ] Clicking duplicate from `/invoices` writes ZERO rows to the `invoices` table. Navigating to `/invoices/new?from=<id>`, populating the form, then closing the tab leaves the DB unchanged.
- [ ] `/invoices/new?from=<id>` renders a pre-filled `<InvoiceForm>` (minus `btc_address` and `btc_txid`).
- [ ] Manual: no `NEXT_REDIRECT` error dialog or console noise during the duplicate flow.

**Done when:** duplicating an invoice and then clicking Cancel leaves zero rows in the database; the `NEXT_REDIRECT` UI artifact is gone.

---

### ⏳ v1.4.26 — Client `invoice_published` Email: Subject + Body Rework

**Branch:** `v1.4.26/client-email-rework`

**Context:** the recipient-facing `invoice_published` email (`src/lib/email/templates/`) has three friction points:

1. **Subject** reads as transactional metadata (`Invoice INV-001 from <sender>`). The recipient may not realise it's a payment ask at all.
2. **Body opens by restating the subject** before the greeting. Redundant.
3. **No in-email guidance on how Bitcoin payment works.** The recipient gets a CTA to view the invoice but no explanation of what to expect when they click through.

**Scope**
- [ ] **Subject** → `You've received an invoice from <sender>`, where `<sender>` follows the existing fallback chain `your_name || your_company || your_email` (same chain `publishAndSendEmail` already uses for `senderName`).
- [ ] **Body opening** → drop the "Invoice X from Y" line. Open with `Hi there,` (or `Hi <client_name>,` when `client_name` is set — confirm the current template's recipient-name awareness from v1.4.4).
- [ ] **Payment instructions paragraph** → add a short section explaining how Bitcoin payment works on SatSend: "Click through to view the invoice. SatSend accepts Bitcoin only — you'll see the BTC address, a QR code, and a live BTC/fiat conversion. Pay from any wallet; we'll detect the payment automatically." Tone matches the existing template.
- [ ] Update template tests/snapshots in `src/lib/email/templates/`.

**Out of scope**
- Subject variants per state (overdue, etc.) — separate work.
- Localisation — single-language for now.

**Tests**
- [ ] Subject snapshot: reads `You've received an invoice from <sender>`, with each of the three fallback-chain branches exercised.
- [ ] Body snapshot: starts with `Hi there,` or `Hi <client_name>,`; does not contain the substring `Invoice <number> from`; contains a Bitcoin-payment-instructions paragraph.

**Done when:** the published-invoice email subject leads with the recipient's framing; the body greets cleanly without metadata duplication; payment instructions are visible without clicking through.

---

### ⏳ v1.4.27 — Owner Notification: Email Sender on Publish

**Branch:** `v1.4.27/sender-publish-notification`

**Context:** today only the recipient gets an email when an invoice is published. The owner has no inbox confirmation, no nudge on next steps (share the link, track activity), no post-publish receipt. Adds a new email type sent to the owner whenever any of `publishInvoice`, `publishAndSendEmail`, or `publishAndMarkSent` succeeds.

**Schema**
- [ ] Migration: extend the `email_type` enum with a new value (working name `invoice_publish_confirmation`; bikeshed in PR).

**Template**
- [ ] New template `src/lib/email/templates/invoice-publish-confirmation.tsx`. Subject: `Your invoice has been published`. Body shape:
  - `Hi <your_name || "there">,`
  - `Your invoice <invoice_number> to <client_name> has been successfully published on SatSend.` Drop the "to <client_name>" clause when `client_name` is missing; substitute or drop the `<invoice_number>` clause when missing.
  - **Sharing section.** The public invoice URL (`<app-url>/invoice/<id>`), plus the access code on a separate line when `access_code` is set ("If your client asks for an access code: `<code>`").
  - **Tracking section.** Link back to the dashboard invoice page with a one-line cue: "Track payment status, email delivery, and other activity at: `<dashboard-url>`."
  - Standard footer (matches existing templates).

**Wiring**
- [ ] `sendInvoicePublishConfirmationEmail` in `src/lib/email/send.ts`, mirrors `sendInvoicePublishedEmail`'s shape (idempotency, `email_events` row, error handling, `senderName` fallback chain).
- [ ] Call from all three publish entry points in `src/app/(dashboard)/invoices/actions.ts`. Recipient: `your_email`. If missing, skip silently and log; **never block the publish**.
- [ ] Activity feed: confirm whether a new event type is needed or whether the existing `email_events` row surfaces transitively. Decide in PR.

**Out of scope**
- Owner notifications for payment events, overdue flips, etc. — separate work.
- A user-facing "don't email me publish confirmations" preference — premature; revisit if anyone complains.

**Tests**
- [ ] `sendInvoicePublishConfirmationEmail` writes an `email_events` row with the new `email_type`, calls Resend with the right subject + body, returns the same shape as `sendInvoicePublishedEmail`.
- [ ] Template snapshots: all-fields-populated; no `client_name`; no `access_code`; no `your_name`; no `invoice_number`.
- [ ] Each of the three publish actions triggers the confirmation email.
- [ ] Missing `your_email` skips the send without throwing or aborting the publish.
- [ ] `publishAndSendEmail` triggers BOTH the client `invoice_published` email AND the owner's confirmation email; both rows appear in `email_events`.

**Done when:** every publish path sends the owner a confirmation email containing the invoice number, client (when set), public-share link, access code (when set), and a tracking link back to the dashboard. Sending failure never blocks the publish itself.

---

### ⏳ v1.4.28 — Cron strategy decision before launch (Vercel Hobby workaround) — SUPERSEDED by v1.4.28-H (S3)

> **Superseded:** the decision is made (Option B — free external scheduler on
> Hobby tier) and the work is **v1.4.28-H (S3)** in the hardening train above,
> which also fixes the time-based schedule. This section is kept for reference.

**Branch:** `v1.4.28/cron-strategy` (or fold into the Vercel deploy/launch branch when that lands)

**Context:** v1.4.18 shipped with `vercel.json` cron set to `0 0 * * *` (once daily) because Vercel Hobby tier hard-rejects sub-daily schedules at deploy time. The original schedule (`* * * * *`, every minute) drives two important behaviours that the daily fallback breaks:

1. **BTC payment detection backfill.** The cron is what notices a payer's tx landed when the payer doesn't have the public payer page open. With daily cron, pay-and-walk-away payers don't appear as paid in the owner's dashboard until up to 24h later. Engaged payers (with the public page open) still get realtime detection via the WebSocket + REST polling that v1.4.13 wired up, so this is a "stale-tab" UX problem, not a complete outage.
2. **`next_check_at` exponential backoff (v1.4.1).** The per-invoice schedule assumes minute-ish tick rates. Daily ticks push `next_check_at` days or weeks out after only a few runs, so the schedule effectively stops working for older invoices.

Acceptable while there are zero real paying users; must be resolved before launch.

**Options**

- **Option A , Vercel Pro ($20/mo).** Restore `* * * * *` in `vercel.json`. Zero code changes. Cleanest. The "right" answer for a real product.
- **Option B , External cron service.** Keep `vercel.json` on daily, but point a free third-party cron service (`cron-job.org`, `EasyCron`, `cron-job.de`) at `https://<production-domain>/api/cron/payment-sweep` every minute. The route already accepts `Authorization: Bearer $CRON_SECRET` (`src/app/api/cron/payment-sweep/route.ts:38`) , no code changes needed, just configure the external service with the URL + bearer header. Free, every-minute, full restoration of behaviour. Downside: one extra third-party dependency in a payment-critical path; must monitor it.

**Scope**
- [ ] Pick Option A or Option B (decision call, not implementation work).
- [ ] If A: upgrade the Vercel project to Pro; revert `vercel.json` to `* * * * *`; verify cron runs as expected in production logs.
- [ ] If B: pick the external service, configure the cron job with the production URL and `CRON_SECRET` bearer header, leave `vercel.json` on daily, verify the external service successfully hits the endpoint and produces a `200`.

**Done when:** payment-sweep is verifiably running on a sub-daily cadence in production, and the Activity feed / dashboard reflects on-server detection within minutes of a payer's tx confirming.

---

### ⏳ v1.4.34: Legal & Compliance Bundle (pre-launch, non-urgent)

**Branch:** `v1.4.34/legal-compliance-bundle`

> **Priority:** Not urgent. Slot it anywhere before launch. Nothing else in the
> train depends on it, and it blocks nothing in the hardening train or the rest
> of the feature queue.

**Context:** A legal-risk audit flagged six items to handle before the product
takes real users or sends real marketing. Five are code or config work; one
(DMCA agent) is a registration walkthrough. Grouped into one branch because they
are all compliance-shaped and each is individually too small for its own PR.

**Scope**

1. **Age gate at signup.** Add a minimum-age confirmation to the signup flow so
   under-age users cannot create an account (COPPA / GDPR-K). Match the existing
   magic-link signup UX and record an `age_confirmed_at` timestamp on the user.
2. **Self-host fonts.** Stop loading fonts from Google Fonts (or any third-party
   font CDN) and serve them from our own domain so no visitor IP is handed to a
   third party. Switch to `next/font/local` with the font files committed.
3. **Session replay.** Either turn session-replay tooling off entirely, or (if
   we keep it) add an explicit consent banner plus input masking so no email,
   access code, or payment detail is ever recorded. Audit which replay or
   analytics tools are actually loaded first; if none, close this item as a
   no-op with a note.
4. **Marketing-email compliance.** Every marketing email must carry a working
   one-click unsubscribe link and a physical postal address in the footer
   (CAN-SPAM). Transactional emails (invoice published, payment
   detected/confirmed) are exempt, but should share the same footer component so
   the split stays deliberate.
5. **Renewal terms next to the subscribe button.** Any auto-renewing purchase
   must show its renewal terms immediately adjacent to the call to action
   (amount, cadence, cancellation policy), not buried in a linked policy. Applies
   to the v2.0 premium upgrade flow when it lands; wire it in there if that ships
   first.
6. **Register a DMCA agent.** Walk the user through registering a designated
   DMCA agent with the US Copyright Office (filing fee is currently $6), then add
   the agent name and contact details to the site's copyright/terms page and a
   new `/dmca` policy page.

**Notes**
- Items 4 and 5 depend on surfaces that do not exist yet (marketing email, the
  premium subscribe flow). If those ship first, fold these in there; otherwise
  keep this item as the catch-all and finish them here.
- Item 6 is non-code and needs the user's input, so split it out if it stalls the
  code work.

**Tests**
- [ ] Signup without confirming the age gate is rejected; with it, an
      `age_confirmed_at` timestamp is written.
- [ ] No network request leaves the app to a third-party font host on any page.
- [ ] Session replay (if enabled) masks input fields in a recorded session; if
      disabled, no replay script is loaded.
- [ ] Every marketing-email snapshot contains an unsubscribe link and a postal
      address.
- [ ] Renewal-terms copy renders adjacent to the subscribe button (once that
      surface exists).
- [ ] `/dmca` page renders the registered agent details.

**Done when:** all six items are either done or explicitly closed as
not-applicable with the reason recorded, and no marketing email, signup path, or
subscribe button ships without its required disclosure.

---

### ⏳ v1.5 — Full Site Redesign (Brand Handoff — "Signal Amber", Option D)

**Branch:** `v1.5/redesign`

> **Design source of truth:** `satsend-brand-handoff/` — read `DESIGN.md` first,
> then `design-tokens.css` and `agent-implementation-brief.md`. Written tokens and
> component rules win over any generated reference imagery. The supplied
> `SatSendLogo.tsx` is the wordmark component to use.
>
> **Sequencing:** run this immediately after the hardening train's Phase 0 + Phase
> 1 are green (tech working), and before the remaining feature queue — so the
> redesign is only built once. The old "pick a colour scheme" blocker is resolved
> by this handoff.

**Locked brand decisions**
- Direction: Option D / Signal Amber.
- Display/logo font: **Onest**. UI/body font: **Geist Sans**.
- Primary: `#D89B24`. Canvas: `#FCFBF7`. Text: `#151C2E`.
- Not green-led. Green = success/Paid; violet = Payment detected; blue = Sent;
  warning orange = Underpaid; red = Overdue.
- Bitcoin visual explicitness ≈ 2–2.5 / 5.

**Scope**
- [ ] Load Onest + Geist Sans; import `design-tokens.css` globally; retire the
      current near-black + red `#DE3C4B` palette.
- [ ] Rebuild the base primitives against the tokens: Button, Input, Card,
      StatusBadge.
- [ ] Use the supplied `SatSendLogo.tsx` inline-SVG lockup (do not rebuild the
      wordmark from separately positioned spans).
- [ ] Apply neutral surfaces and borders across the product **before** adding amber.
- [ ] Apply the semantic status colours across badge, email templates, and PDF.
- [ ] Refactor the dashboard, invoice detail, and public payer pages onto the new
      spacing and type scales.
- [ ] Build marketing pages using the product UI itself as the core visual.
- [ ] Mobile: 44px minimum touch targets.
- [ ] Accessibility/contrast pass before completion.
- [ ] Light/dark: the handoff defines a light canvas and dark text. Decide whether
      the app becomes light-first (retiring the old dark-only theme) or ships both;
      record the decision in the PR. The old mandatory dark/light toggle is
      superseded.

**Coordinates with:** Appendix A → A-3 (realtime & styling unification) — its
styling half lands here, not separately.

**Done when:** every surface (dashboard, invoice detail, public payer page, emails,
PDF) renders in the Signal Amber system, the logo is the supplied component, the
status-colour mapping is exactly as locked above, and an accessibility pass is clean.

---

### ⏳ v1.6 — Bitcoin Enhancements

**Branch:** `v1.6/btc-enhancements`

- [ ] Optional BTC discount field on invoice creation (% value, e.g. 5%)
- [ ] Discount only applies if the invoice is paid in Bitcoin — shown on the client payment view as a line item reducing the BTC amount
- [ ] Discount displayed on client view alongside the BTC amount (e.g. "5% BTC discount — save $X")
- [ ] Discount not reflected in the fiat total; it is a BTC-payment incentive only

**Done when:** A freelancer can offer a percentage discount to clients who pay in BTC, visible only on the payment view.

---

### ⏳ v1.7 — Address Format Standardisation

**Branch:** `v1.7/address-fields`

> **Note:** This branch changes the address data model. Should land before v2.2 (saved clients) since those features depend on the address structure.

- [ ] Replace single freeform `your_address` / `client_address` text fields with structured fields: Line 1, Line 2, City, State/Province, Post Code, Country — following the UN/OASIS xNAL address standard ordering
- [ ] Schema migration: add individual address sub-columns (nullable); keep old `*_address` column for migration only, then drop after backfill
- [ ] Update invoice form with the new multi-field address layout
- [ ] Update invoice detail page (user view) and client payment view to render the structured address correctly
- [ ] No auto-fill or address lookup required

**Done when:** All address inputs are structured multi-field; old freeform address column removed; views render the structured address neatly.

---

## v2 — Growth (Monetisation + Ecosystem)

> Goal: Launch a free tier and a paid (Pro) tier, then expand the creator experience.

> **This is the launch monetisation plan.** It replaces the earlier "premium, feature-gated later" sketch. The free/paid split, the email rules, and the build order below are agreed. The `v2.x` numbers are IDs; the **Phase** labels are the build order.

### Monetisation plan (free vs Pro)

**Philosophy**
- Invoicing is **unlimited on both tiers**. Volume caps are a losing game (throwaway emails defeat them) and the per-invoice cost is near zero: an unpaid invoice is polled roughly 7 times over ~48 min, then hibernates. Monetise **features**, not volume.
- Keep the core loop free forever: create an invoice, the payer pays, both sides are told. Sell polish, automation, and integration.
- Gate on what costs real money per use (client email to arbitrary recipients, API resources) and on what a freelancer will happily pay for (looking professional, chasing late payers).

**Free**
- Unlimited invoices, BTC payment detection, share link, PDF, dashboard.
- Owner-facing "payment detected" and "payment confirmed" emails (the "you got paid" pair). This is the heartbeat of the product and stays free.
- No client-facing email. No pretty links, client pages, branding, reminders, reports, or API.

**Pro**
- Pretty links (`satsend.me/theircompanyname`) and client pages (`satsend.me/theircompanyname/<client>`).
- Saved clients + reusable line items.
- Custom branding (logo, colours) across the invoice page, PDF, client page, and emails.
- Client-facing email with a display-name sender (see email rules).
- Payment reminders.
- Financial reports + export.
- API access.

**Email rules (locked)**
- **All client-facing email is Pro-only.**
- **Owner-facing payment notifications stay free.** Rule of thumb: if the system is *telling the owner something happened*, free; if it is *doing work for them* (sending to clients, chasing, digests), Pro.
- **Custom sender = display name only**, e.g. `Acme Studio <team@mail.satsend.me>`, with reply-to set to the owner's email so replies reach them. **Never** the owner's own domain: that needs the user to configure DNS, and misconfiguration sends their mail to spam and creates support load. Out of scope permanently unless demand appears.
- **Do not gate payer-page live updates.** That is the *payer's* experience and the payer will never be the customer. Gating it punishes the wrong person.

**Entitlement model (locked)**
- Store one column: `premium_until timestamptz`. `isPremium = premium_until > now()`. No separate `tier` column and **no downgrade cron**; expiry is automatic. Use `infinity` for lifetime / grandfathered accounts.
- One central helper, `getEntitlements(userId)`, returns the flags. Every gated surface calls it and nothing else, so changing the paid feature list later is a one-file change.

**Billing (locked)**
- **Bitcoin-only** at launch (hard rule). Reason: the operator is a foreign LLC owner with no business bank account, so fiat rails are not viable.
- **Self-serve from day one** (no manual flag-flipping).
- **Model an upgrade as a special invoice.** Reuse the existing address-watch / sweep / detection / dedup machinery. An "upgrade attempt" has an address, an amount, a status, and a schedule, exactly like an invoice; the only new pieces are (a) derive the address from a platform billing key instead of asking the user, and (b) on confirmation, extend `premium_until` instead of marking an invoice paid.
- Keep reconciliation dumb: one attempt, one fresh address, flip on confirm.
- Price in fiat, convert to BTC at attempt time, lock for ~15 min.
- Use a **dedicated billing seed**, separate from any personal wallet, so a leak exposes billing addresses only.

**Access codes for client pages (locked)**
- The client page has a top-level access code. Entering it satisfies the access codes of the invoices listed under that client, so the client never types a code twice.
- Standalone invoice links still use the invoice's own code. Invoices with no client attached always use their own code.

**Build order**
- **Phase 1 (launch Pro):** v2.0 -> v2.1 -> v2.2 -> v2.3 -> v2.4 -> v2.5 -> v2.6
- **Phase 2:** v2.7
- **Phase 3:** v2.8
- **Later:** v2.9, v2.10, v2.11, v2.12

> If you want to open the doors sooner, the natural cut line is to launch with **v2.0-v2.3** (billing, pretty links, saved clients, client pages) and add v2.4-v2.6 (branding, client email, reminders) in the weeks right after, at the same price. Early Pro buyers keep everything.

---

### 🚫 v2.0: Premium accounts: entitlement + Bitcoin billing (foundation)

**Branch:** `v2.0/premium-bitcoin`

**Context:** Everything else in v2 sits on this. Until the entitlement layer and a way to take money exist, nothing can be "Pro." Bitcoin-only, self-serve from day one.

**Scope**
- [ ] Entitlement model per the plan above: single `premium_until` column, `isPremium` computed, no downgrade cron, and one `getEntitlements(userId)` helper that every gate calls.
- [ ] Bitcoin billing built on the existing invoice machinery (address watch + sweep + detection + dedup), not a parallel system. An "upgrade attempt" reuses the invoice shape; confirmation extends `premium_until`.
- [ ] Tier picker: 1 month / 6 months / 12 months. Fiat price converted to BTC at attempt time, locked ~15 min.
- [ ] Address derivation from a dedicated `BILLING_XPUB` (BIP84 `m/84'/0'/0'/0/n`), per-user index, never reuse an address, audit log of every derived address.
- [ ] "Upgrade" / "Go Premium" CTA in settings + a free-tier nav banner.
- [ ] Premium-gated surfaces show a "Pro" badge with an upgrade CTA.
- [ ] Server-side gate helper rejects free-tier requests on every gated route/action.
- [ ] Renewal adds months to `max(now(), premium_until)`.

**Decisions to lock before implementation**
- Exact pricing for 1m / 6m / 12m.
- Whether to offer "extend by N months" before expiry, or only post-expiry renewal.
- Refund policy (likely none; bitcoin is final).
- Do users get a receipt for their own premium payment?
- What happens to Pro-only state on downgrade (e.g. API keys: revoke or grace?).

**Out of scope (deferred)**
- Fiat billing rails (Lemon Squeezy, Stripe). Bitcoin-only; revisit only on real demand.
- Free-tier invoice quotas. Feature-gated, not volume-gated.
- Per-feature à la carte purchases. One paid tier, one price ladder.

**Done when:** A free user can click Upgrade, pay in bitcoin to a fresh derived address, and have `premium_until` extended automatically on confirmation; every gated surface rejects free requests; expiry needs no cron; the audit log maps every billing address to its user and attempt.

---

### 🚫 v2.1: Pretty links (owner slug)

**Branch:** `v2.1/pretty-links`

**Context:** Give every Pro user a readable URL for their business, `satsend.me/theircompanyname`, so shared links look professional instead of exposing an opaque invoice ID.

**Scope**
- [ ] Unique `slug` per user (on the user/profile record). Reserved-word list so nobody takes `dashboard`, `api`, `invoice`, `invoices`, `login`, `settings`, `admin`, `help`, etc.
- [ ] `satsend.me/<slug>` renders a Pro front page. **Keep existing invoice URLs unchanged**; the pretty link points at them. Do not rewrite the invoice routing or the access-code flow.
- [ ] Slug is editable in settings; handle collisions with a clear error.
- [ ] Pro-only: free users see the feature with an upgrade CTA.

**Decisions to confirm**
- Redirect old slugs on change, or free them?
- Whether the front page is a simple landing card or a lightweight public index.

**Done when:** A Pro user can claim a slug, and `satsend.me/<slug>` resolves to their front page without clashing with any real app route.

---

### 🚫 v2.2: Saved clients + reusable line items

**Branch:** `v2.2/saved-clients`

> **Depends on:** v1.7 (structured addresses).

**Context:** Today a "client" is just text typed on each invoice; there is no client record. This entry introduces the client entity, which is the prerequisite for client pages (v2.3). Building it also delivers the saved-clients convenience.

**Scope**
- [ ] `clients` table: `(id, user_id, name, email, company, structured address, tax_id, slug, created_at)`. Invoices link to a client (nullable; free-form invoices still allowed).
- [ ] Client slug: readable, scoped to the owner (so no cross-owner collision), deduped with a suffix. DB key stays the client ID. Recommended URL form `<name>_<shortid>` (readable and collision-proof); confirm at build time.
- [ ] Client picker on the invoice form pre-fills client fields, plus a "save this client" affordance.
- [ ] Manage clients (add / edit / delete) from a clients page or settings.
- [ ] Saved sender (own) details: one set, pre-filled on the form.
- [ ] Reusable line-item templates.
- [ ] Confirm whether saved clients themselves are free or Pro (client pages in v2.3 are Pro).

**Out of scope**
- Multi-tier client grouping / tags.
- Address lookup / auto-fill.

**Done when:** An owner can save a client and reuse it on new invoices, and every invoice can be tied to a client record.

---

### 🚫 v2.3: Client pages

**Branch:** `v2.3/client-pages`

> **Depends on:** v2.1 (owner slug), v2.2 (client entity).

**Context:** A Pro page per client at `satsend.me/theircompanyname/<client>` listing the invoices between the owner and that client, so the client can see what they owe without the owner re-sending links.

**Scope**
- [ ] Route `/<owner-slug>/<client-slug>` rendering that client's invoices.
- [ ] Show **published invoices only** (never drafts). Default view: **open invoices** (pending, payment detected, overdue). Confirm whether to add a collapsed paid-history section (a running statement reads more professional).
- [ ] Top-level access code on the client page (per the locked access-code rule above): entering it satisfies the codes of the invoices listed, so the client is not asked twice. Standalone invoice links still use the invoice's own code.
- [ ] Links from the page open the existing invoice URLs.
- [ ] Pro-only.

**Decisions to confirm**
- Open invoices only, or open plus a paid-history section?
- Cookie scope for the "client code already entered" grant (signed, includes the client ID).

**Done when:** A client can open their page with one code, see their open invoices, and open any of them without a second code; drafts never appear.

---

### 🚫 v2.4: Custom branding

**Branch:** `v2.4/custom-branding`

**Context:** The most visible "looks professional" upgrade: the owner's logo and colours on everything the client sees.

**Scope**
- [ ] Logo upload + brand colours on the user/profile record.
- [ ] Applied consistently across the invoice page, the PDF, the client page, and the email templates.
- [ ] Build **after** the client page and client email exist so branding is applied in one pass rather than sprinkled into each feature.
- [ ] Pro-only.

**Out of scope**
- Full theme / layout customisation beyond logo + colours.
- Custom email templates beyond branding.

**Done when:** A Pro user's logo and colours appear on every client-facing surface.

---

### 🚫 v2.5: Client-facing email + display-name sender

**Branch:** `v2.5/client-email`

**Context:** Today email goes out from `SatSend <team@mail.satsend.me>` to both owner and payer. This entry makes client-facing email a Pro feature and makes it look like it came from the owner.

**Scope**
- [ ] Gate **all client-facing email** behind Pro. Keep owner-facing payment notifications free.
- [ ] **Display-name sender**: send as `<owner company> <team@mail.satsend.me>`, with reply-to set to the owner's email. Built branding-aware (v2.4).
- [ ] Free users: no client-facing email; share-link delivery only.
- [ ] Owner notification emails stay free and unchanged.

**Out of scope (permanently)**
- Sending from the owner's own domain. It requires the user to configure DNS; misconfiguration routes their mail to spam and creates support load. Revisit only on real demand.

**Done when:** A Pro user's client email arrives from the owner's display name with replies going to the owner; a free user's client-facing sends are refused and the UI offers an upgrade.

---

### 🚫 v2.6: Payment reminders

**Branch:** `v2.6/reminders`

> **Depends on:** v2.5 (client-facing email).

**Context:** Chasing late payers is the top admin pain for freelancers, and the app already detects overdue invoices. Reminders are automation layered on infrastructure that exists.

**Scope**
- [ ] Scheduled reminder emails to the client for overdue (and optionally upcoming-due) invoices.
- [ ] Reuse the existing overdue sweep and email pipeline.
- [ ] Owner controls: on/off, cadence, message. A sensible default schedule.
- [ ] Pro-only.

**Decisions to confirm**
- Default cadence (e.g. on due date, +3 days, +7 days).
- Whether the owner can preview / edit copy.

**Done when:** A Pro owner's overdue invoice automatically emails the client on schedule, and the owner can turn it off.

---

### 🚫 v2.7: Financial reports + export

**Branch:** `v2.7/reports`

**Phase 2.**

**Context:** The small-business end of the market wants income, outstanding, and overdue at a glance, and wants to get the numbers out.

**Scope**
- [ ] Reports page: income over time, outstanding, overdue, per-client totals, BTC received.
- [ ] CSV export (and optionally PDF).
- [ ] Pro-only.
- [ ] Confirm the money fields are trustworthy before building (this area has moved recently).

**Out of scope**
- Accounting-software sync (that is API / ecosystem territory).

**Done when:** A Pro user can view their figures and export them.

---

### 🚫 v2.8: Public API + AI Agent Access (premium-gated)

**Branch:** `v2.8/public-api`

**Phase 3.**

> **Depends on:** v2.0 (entitlement system).

**Context:** Let premium users interact with SatSend programmatically. Primary use case: AI agents creating invoices, checking payment status, and sending emails on the user's behalf without a browser session. Secondary use case: third-party integrations (accounting tools, custom dashboards). Gated to premium so the API surface is a value-add of the paid tier rather than a free-tier abuse vector.

**Scope**

Auth + key management
- [ ] `api_keys` table: `(id, user_id, key_hash, name, last_used_at, created_at, revoked_at)`. Store only the hash; show the raw key once at creation time.
- [ ] Settings page → API keys section: generate / name / revoke.
- [ ] Bearer-token auth middleware for `/api/v1/*` routes. Reject if no key, key revoked, hash mismatch, or owning user is not currently premium.
- [ ] Rate limit per key: starting point 60 req/min, room to tune. Use the existing infra if any, otherwise per-key in-memory or Redis (decide during implementation).

Endpoint surface (v1 — match what the browser UI exposes)
- [ ] `POST /api/v1/invoices` — create draft.
- [ ] `GET /api/v1/invoices` — list.
- [ ] `GET /api/v1/invoices/{id}` — fetch.
- [ ] `PATCH /api/v1/invoices/{id}` — update draft (only `status='draft'`).
- [ ] `DELETE /api/v1/invoices/{id}` — delete draft.
- [ ] `POST /api/v1/invoices/{id}/publish` — publish.
- [ ] `POST /api/v1/invoices/{id}/send-email` — publish + send.
- [ ] `GET /api/v1/invoices/{id}/payment-status` — current payment + tx status.
- [ ] `POST /api/v1/invoices/{id}/duplicate` — duplicate to draft.
- [ ] `POST /api/v1/invoices/{id}/mark-paid` / `mark-unpaid` / `mark-overdue` — manual state transitions matching the dashboard.
- [ ] `GET /api/v1/me` — current user info + premium status (so agents can self-check entitlements).

Documentation + DX
- [ ] OpenAPI spec checked into the repo, served at `/api/v1/openapi.json`.
- [ ] Quickstart docs page: generate key, curl example, send-an-invoice walkthrough.
- [ ] AI-agent-friendly docs section: stable JSON shapes, error codes, idempotency guidance.

Security + observability
- [ ] All API responses tagged with the key id in logs (not the raw key).
- [ ] Webhook signing if/when webhooks are added (out of scope for v2.8; placeholder).
- [ ] Audit log per key: every request line with timestamp, route, status, latency.
- [ ] Tests: revoked-key path returns 401; expired-premium path returns 403; rate-limit path returns 429.

**Decisions to lock in (grilling session)**
- Versioning policy: `/api/v1/*` permanent, breaking changes only via `/api/v2/*`?
- Webhook support — in v2.8 or later? (Real-time payment notifications via webhook is the natural agent integration.)
- Read-only vs read-write keys, or single permission level?
- Per-key vs per-user rate limits.

**Out of scope (deferred)**
- Third-party OAuth applications (programmatic access on behalf of *other* users). Single-user keys only at v2.8.
- Webhooks (deferred follow-on; would land as v2.X once the API surface is stable).
- GraphQL. REST + JSON only.
- SDKs. Curl + the OpenAPI spec is enough at v2.8; community / first-party SDKs can follow.

**Done when:** A premium user can generate an API key from settings, use it to perform the full invoice lifecycle (create / publish / send / check-status / mark-state) via curl, hit a documented rate limit, and revoke the key cleanly; an AI agent given a key can drive the same flows; non-premium users receive 403 on every API route; the OpenAPI spec is the source of truth and is served from the deployment.

---

### 🚫 v2.9: Referral codes

**Branch:** `v2.9/referral-codes`

**Later.**

> **Depends on:** v2.0 (entitlement system — the payout target is Pro signups).

**Context:** Every account gets a referral code at signup. New users can sign up with someone's code. Referrers earn a cut of premium signups they bring in. Mechanism designed to grow word-of-mouth without paid ads.

**Scope (sketch — needs a grilling session before implementation)**

Code lifecycle
- [ ] Auto-generated referral code per user at signup. Short, memorable, URL-safe (e.g. 8 chars). Stored on `users.referral_code unique`.
- [ ] Visible in settings; user can copy / share.
- [ ] Sign-up flow accepts an optional code (form field + `?ref=CODE` URL parameter).
- [ ] On successful signup with a valid code, set `users.referred_by_user_id` on the new user (immutable post-signup).

Payout mechanics
- [ ] On a premium upgrade by a referred user, calculate the referrer's cut.
- [ ] Decide payout mechanism: bitcoin payout to a referrer-supplied address vs. credit toward the referrer's own premium subscription. Each has UX + accounting implications.
- [ ] Track payout state per referral event: `pending` → `paid` (with txid if BTC) / `credited` (if applied to subscription).

UX
- [ ] Settings page section showing: your code, total referrals, total earnings (in $ or BTC), pending payouts.
- [ ] Optional landing-page support for `?ref=CODE` so the code persists through signup-via-marketing-link.

**Decisions to lock in (grilling session — explicit per the user's request)**

The user has flagged this entry as needing a thorough grilling before any code is written. Open questions:
- **Payout percentage.** A flat percent of the premium payment (e.g. 10%, 20%, 30%)? Higher for the first signup, decaying after?
- **Time bound.** One-shot (only the first premium payment by the referee), bounded (12 months of the referee's premium), or lifetime?
- **Currency.** Pay out in BTC to a referrer-supplied address, or credit toward the referrer's own premium time? The latter is operationally simpler (no fresh BTC sends per payout) but only useful to active premium users.
- **Self-referral / collusion.** Block obvious self-referrals? Detection is hard; anti-fraud is a rabbit hole.
- **Stacking.** What if a referee uses multiple codes (e.g. code A at signup, then code B applied later)? Likely first-code-wins, but lock it in.
- **Referrer downgrades.** If a referrer lapses to free, do their pending payouts continue to accrue?
- **Disclosure.** Referral programs typically need terms-of-service language; out of scope for the engineering branch but flag for the user.

**Out of scope (deferred)**
- Multi-tier (referrer of a referrer) attribution. Single-hop only.
- Custom-vanity codes (paid feature for marketing partners). Auto-generated only.
- Affiliate-style dashboards with conversion analytics. Settings-page summary only at v2.9.
- Coupon-style codes that grant a discount to the referee. Referee gets the standard signup; only the referrer earns.

**Done when:** Every account has a referral code; a new user signing up via `?ref=CODE` or the form field has the relationship recorded; a premium upgrade by a referred user produces a payout event whose mechanics are exactly as decided in the grilling session above; the referrer can see their referrals and payout state from settings.

---

### 🚫 v2.10: OAuth

**Branch:** `v2.10/oauth`

- [ ] Google OAuth
- [ ] GitHub OAuth
- [ ] LinkedIn OAuth

---

### 🚫 v2.11: Custom subdomains

**Branch:** `v2.11/custom-subdomains`

- [ ] Wildcard subdomain routing (`yourcompany.satsend.me`) as an alternative to the path-based pretty links (v2.1)

---

### 🚫 v2.12: Multi-currency support

**Branch:** `v2.12/multi-currency`

- [ ] Currency selector on invoice creation (USD, EUR, GBP, AUD, CAD, etc.)
- [ ] BTC price fetched in the selected fiat currency
- [ ] Dashboard shows currency alongside invoice totals

---

## Notes

- Billing (v2.0+) is part of the launch plan (free + Pro), sequenced after the security hardening train. The free/paid split and build order live in the v2 section above.
- **Future: publish under a different GitHub identity.** The project currently lives
  under the `jonnymarshall` GitHub account. Jonny wants it moved to a separate,
  anonymous identity before public launch (a concern about anonymity, not
  plagiarism — the code can stay public). Not done now; revisit before launch. A
  duplicate private repo (`jonnymarshall/satsendofficial`) was deleted on
  2026-10-06 and the Vercel project re-pointed at the real `SatSend` repo.
- **xpub / HD wallet policy.** The platform never accepts an xpub from a *user* for invoice payment addresses — the security trade-off (key leak exposes every derived address) is the wrong one for that surface. **Single deliberate exception:** v2.0 premium-account billing uses a platform-controlled `BILLING_XPUB` to derive a per-user upgrade address. Reasoning: per-user attribution of subscription revenue is non-negotiable, manual address provisioning per signup is not viable, and a leaked billing xpub exposes inbound subscription flows only — a manageable blast radius for the value of automating the billing path.
- Light mode and colour scheme overhaul are tracked in v1.5.

---

## Pre-deployment Checklist

The Vercel project `satsendofficial` is linked and deployed. Use this checklist to keep all `.env` values mirrored into Vercel project env vars (Production, Preview, Development) and to verify deploy-time settings stay in sync. Re-check it whenever a new env var is introduced or an existing one changes.

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (if used server-side)
- [ ] `RESEND_API_KEY` (added v1.4)
- [ ] `CRON_SECRET` (added v1.4.1) — bearer token the Vercel Cron endpoint validates. Vercel generates this when you configure the cron in the dashboard; mirror it into `.env.local` for local `curl` testing.
- [ ] `PAYMENT_SWEEP_ENABLED=true` in the environment that owns the payment sweep (production, or the external scheduler). Without it the sweep route no-ops (single-writer guard, v1.4.19.2-H). Do **not** set it in local development.
- [ ] **Verify a sending domain in the Resend dashboard** and set `EMAIL_FROM` to an address on that domain. Without a verified domain, Resend only delivers to the email address on the Resend account itself — sends to any other recipient (clients, test addresses) return a 422 and the email never arrives. This is a Resend free-tier safety rail, not a Paybitty bug.
- [ ] **Sender identity unified (v1.4.4)** — set `EMAIL_FROM="SatSend <team@mail.satsend.me>"` in `.env` and in Vercel project env vars (Production, Preview, Development). Confirm the Supabase custom SMTP "Sender" address (dashboard → Project Settings → Auth → SMTP Settings → Sender) is set to the same `team@mail.satsend.me` so transactional mail and auth mail share a single `From:` identity.
- [x] **Supabase custom SMTP → Resend** — configured 2026-04-24 in Supabase dashboard (Project Settings → Auth → SMTP Settings) pointing at `smtp.resend.com:465` with the `RESEND_API_KEY` as the password and a sender on the verified `mail.satsend.me` domain. This routes all Supabase auth emails (magic link, signup confirmation, password reset) through Resend and bypasses Supabase's default ~4/hour rate limit. Project-level setting — applies to both local dev and production automatically.
- [ ] Any other secrets present in `.env` at deploy time
- [ ] **Vercel env vars flagged `readable-secret` (review when convenient, not urgent)** — as of 2026-10-06 four vars are stored as *encrypted* rather than *sensitive*, so anyone with access to the Vercel project can reveal their values. Vercel surfaces this under "Needs Attention" with reason `readable-secret`. Affected (all on Production + Preview): `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `RESEND_WEBHOOK_SECRET`. This is a least-privilege cleanup, not a breach indicator. Fix when it suits the build: re-save each as **Sensitive** (CLI: `vercel env update <NAME> --sensitive`), optionally rotating at the source first (Supabase / Resend dashboards; a new random value for `CRON_SECRET`) since the values have been readable. Blast radius if leaked, highest first: `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS, full DB read/write), `RESEND_API_KEY` (send mail as us), `CRON_SECRET` (can trigger the payment sweep), `RESEND_WEBHOOK_SECRET` (forge Resend webhook events). Caveat: Sensitive vars cannot be read back (not in the dashboard, not via `vercel env pull`), so `.env.local` stays the source of truth for local dev.

---

## Appendix A — Hardening execution detail (folded in from the former HARDENING-ROADMAP.md)


> **`ROADMAP.md` is the single source of truth for sequence.** Every item below
> is listed there (as `v1.4.NN-H`) in the order to do it. This document holds only
> the detailed numbered steps for each item — open the matching S-number or -H
> version here when you start it. If this doc and `ROADMAP.md` ever disagree on
> *what's next*, `ROADMAP.md` wins.

This turns the findings in Appendix B into sequenced,
modular work. It is written to be executed one branch at a time by a model that
follows steps literally. **Do the phases in order.** Phase 0 and Phase 1 are
launch-blockers and money-safety; do not deploy to mainnet or invite any user
until they are green.

## How to use this document (rules for the implementing model)

1. **One version = one branch = one PR**, per the `git-workflow` skill. Branch
   names are given per item. Never commit to `main`/`master`.
2. **Before writing code on an item, invoke the `next-feature` planning gate**:
   read the item, produce the plan, STOP, and wait for the user's go-ahead.
3. **Every item ends green**: `npm run test:run` (0 failures), `npx tsc --noEmit`
   (0 errors), `npm run lint` (0 errors). If the suite is red when you start,
   fix Phase 0 item S0 first — do not add work on top of a red suite.
4. **Migrations**: the next number is `max(existing) + 1`. List
   `supabase/migrations/` and verify ordering before writing. Apply to the remote
   with the `supabase-migrate` skill and confirm success BEFORE opening the PR.
   Prefer `NOT VALID` + backfill + `VALIDATE CONSTRAINT` over destructive deletes.
5. **After each merge**: bump `package.json` version to match, add the git tag
   (`git tag -a vX.Y.Z -m "..."`), update `CHANGELOG.md`, and move the item's
   section to `ROADMAP-ARCHIVE.md`.
6. Each item has a **Done when** line. It is not done until that is literally true.

---

## PHASE 0 — Stop the bleeding (launch-blockers, do first, in order)

### S0 — Green the build (branch `fix/green-the-build`)
The suite is red on `main`; nothing else can proceed safely on top of it.

Steps:
1. In `src/app/(dashboard)/invoices/actions.test.ts`, the 5 failing tests fail
   because fixture `PUBLISHABLE_INVOICE.due_date = "2026-07-10"` is now in the
   past. At the top of that test file, freeze time:
   `beforeEach(() => vi.useFakeTimers().setSystemTime(new Date("2026-06-01T00:00:00Z")))`
   and `afterEach(() => vi.useRealTimers())`. Confirm the 5 tests pass. (Model on
   `payment-schedule.test.ts`, which injects a fixed `NOW` correctly.)
2. Fix the lint error at `src/app/(dashboard)/invoices/columns.tsx:59`: give the
   component returned by `sortableHeader` a `displayName`, or name the function.
3. Run all three gates; all must be clean.

**Done when:** `npm run test:run`, `npx tsc --noEmit`, and `npm run lint` all exit
0 on a fresh checkout.

### S1 — Close the four database exposures (branch `fix/rls-critical-exposures`)
One migration, four fixes. This is the highest-priority item in the whole
document. (Findings CRIT-1, CRIT-2, CRIT-3, plus the realtime re-architecture.)

Steps (new migration `00XX_close_anon_exposures.sql`):
1. `alter view invoice_email_summary set (security_invoker = on);`
   then `revoke all on invoice_email_summary from anon;`
2. `alter table webhook_deliveries enable row level security;` (no policies —
   the service role bypasses RLS; the webhook handler keeps working).
3. Replace the blanket anon policy. First drop it:
   `drop policy "anon_select_non_draft" on invoices;`
   Then re-architect the payer-page realtime so it no longer needs anon table
   reads. Preferred approach: publish status changes from the server over a
   Supabase **broadcast** channel keyed on the invoice id, from a trigger on
   `invoices` (or from the cron/fast-path after a status write). Update
   `src/app/invoice/[id]/use-public-invoice-realtime.ts` to subscribe to that
   broadcast channel instead of `postgres_changes`. (If broadcast is too big a
   step for this branch, ship steps 1-2 immediately as their own PR and do the
   anon-policy replacement in a fast follow — but steps 1-2 must not wait.)
4. Reduce the realtime blast radius:
   `alter publication supabase_realtime drop table public.invoices;`
   `alter publication supabase_realtime add table public.invoices with (publish = 'insert,update');`
   and revert to `alter table public.invoices replica identity default;`
   (nothing in the app reads `payload.old`; confirm with a grep for `payload.old`
   before shipping).
5. In `src/lib/invoice-public.ts`, stop returning `access_code` and `user_id` to
   the client component — select explicit columns or strip them before crossing
   the boundary.
6. Add `import "server-only";` to the top of `src/lib/supabase/admin.ts`, and fix
   `src/app/invoice/[id]/invoice-payment-view.tsx` to `import type { Invoice }`.
7. Verify: with the anon key, `GET /rest/v1/invoice_email_summary?select=*`,
   `GET /rest/v1/invoices?select=*`, and any `webhook_deliveries` read all return
   403/empty. Run `supabase db lint` and confirm the security-definer-view and
   rls-disabled advisors no longer fire.

**Done when:** no anonymous request with the public key can read any invoice,
summary, or webhook row; the payer page still updates live; `supabase db lint` is
clean of those rules.

### S2 — Fix payment forgery + verify amount (branch `v1.4.19/payment-amount-awareness`)
This is CRIT-4 plus the existing roadmap item v1.4.19, which belong together —
implement them as one branch. The v1.4.19 spec (schema, `decidePaymentOutcome`,
tolerance band, UI, tests) is already written in `ROADMAP.md` and is good; follow
it, and additionally:

1. In `src/app/api/invoices/[id]/payment-status/route.ts`, **delete the synthetic
   tx**. Pass the real `tx` fetched on line 62 into the scheduler so
   `status.confirmed` comes from mempool.space, not the request body. Treat the
   client POST purely as a "check now" hint.
2. Persist `expected_sats` (and the price + timestamp used) on the invoice at
   publish time, so detection has a fixed reference amount (finding M-MONEY-1).
   This is the "snapshot the quote" work; do it here since v1.4.19 needs the
   reference value anyway.
3. In detection, sum the vout values paying the invoice address and require
   `received >= expected * (1 - tolerance)` before `paid`; below that, the
   `underpaid` status from the v1.4.19 spec.
4. Require the access-code cookie on the payment-status route (reuse
   `isAccessCodeValid`); return 404 otherwise.
5. Require a confirmation-depth threshold (tip height − tx block height ≥ N)
   before `paid`, not just `confirmed: true`.

**Done when:** a POST with a real 1-sat unconfirmed tx and `status:"paid"` cannot
move the invoice past `payment_detected`, and cannot mark it `paid`; a
below-tolerance payment lands on `underpaid`; the amount and price used are
persisted; all v1.4.19 tests pass plus a new regression test for the forgery
POST.

### S2.1 — Restore public invoice live updates (branch `fix/public-invoice-realtime-authorization`)
Manual v1.4.19-H testing found that the public payer page is denied access to
its own private broadcast channel. The client already calls `setAuth()` before
subscribing and migrations `0022` through `0025` are applied. The remaining bug
is the policy from `0023_broadcast_guard_and_authorization.sql`: it checks a
`topic` field instead of the `realtime.topic()` helper that Supabase uses to
expose the channel being authorized.

Steps:
1. Create a new migration that drops and recreates
   `anon_select_invoice_status_broadcast` on `realtime.messages`. Keep the
   `to anon` and `extension = 'broadcast'` restrictions, but match
   `(select realtime.topic())` against the existing `^invoice:[0-9a-fA-F-]{36}$`
   pattern.
2. Keep the public client channel private and keep the existing awaited
   `supabase.realtime.setAuth()` call. This is a database-policy correction, not
   a reason to weaken the channel or restore anon access to `invoices`.
3. Add a regression test for the client configuration if needed, then apply the
   migration to the remote project before opening the PR.
4. Manually verify with a published invoice left open in a browser. Update that
   invoice through the service-role helper, confirm the page status changes
   without a refresh, and confirm the browser console reports `SUBSCRIBED` with
   no `CHANNEL_ERROR`.

**Done when:** the public payer page receives its own status broadcast without a
refresh, while anonymous database reads of `invoices` remain blocked.

**Outcome:** shipped in `0026_fix_invoice_realtime_policy.sql`. Step 1 was widened
beyond the original plan — the policy now covers `to anon, authenticated`, not
`to anon` alone, because a signed-in owner previewing their own public link
connects as `authenticated` and the old rule excluded them. Regression guard in
`src/lib/realtime-policy.test.ts`.

### S2.2 — One writer per database (branch `fix/environment-and-deployment-hygiene`)
Surfaced during v1.4.19-H manual testing. Two code versions were writing to one
database. The live production deployment (`v1.4.18/resend-webhook`, built
2026-05-19, commit `ad677d47`) runs a cron from its own `vercel.json`
(`"schedule": "* * * * *"`) against the same Supabase project the local dev server
uses, with code that predates the amount-verification work. Evidence: `f94a5826`
and `a5c3b5bf` both received a `payment_confirmed` email and reached `paid` with
`amount_received_*` null and `overpaid` false, confirmed in the same second
(2026-09-12 00:49:43 — one batch), while the branch's own finalisation
(`3e4fc221`, 2026-09-11 23:49:06) recorded `amount_received_sats: 1253` and
`btc_price_at_detection: 77170.58`.

Steps:
1. Stop the stale writer now: remove the cron from the old production deployment,
   or delete that deployment, so no pre-fix code can mutate money state.
2. Give local development its own database (a dedicated Supabase project or a
   Supabase branch) so test invoices never live in production data and the
   production cron can never touch them. Split this out only if it grows too large
   for one PR; the guard in step 3 is the minimum.
3. Add a single-writer guard: gate `/api/cron/payment-sweep` behind an explicit env
   flag (e.g. `PAYMENT_SWEEP_ENABLED`) set only in the environment that should
   sweep, so a stray or stale deployment cannot quietly run the sweep.
4. Add a pre-merge/deploy checklist line: confirm exactly one live code version
   targets a given database, and that production is on the current build.
5. Document the rule in `AGENTS.md` and the manual-test template: local dev must
   not point at the production database.

**Done when:** a fresh local test invoice is never modified by any other
environment; its `paid`/`underpaid`/`overpaid` verdict always carries amounts; and
production is running the current branch with a single sweep owner.

### S3 ✅ — Restore sub-daily detection (branch `v1.4.28/cron-strategy`)
Decided: external scheduler on Hobby tier (CRIT-5). Also fix the schedule math.

**Implemented (v1.4.28-H):** GitHub Actions workflow (`*/5 * * * *`) + a time-based
schedule anchored on `published_at` (pre-mempool) / `mempool_seen_at` (post-mempool)
+ the `published_at` column (migration `0028`) + sweep `.order`/`overdue`/drain/
`maxDuration`. Live end-to-end check is post-merge (the workflow and the
`CRON_SECRET` Actions secret only exist on `main`).

Steps:
1. Keep `vercel.json` — but leave a comment that the daily entry is a Hobby-tier
   placeholder and the real cadence is external.
2. Add a GitHub Actions workflow `.github/workflows/payment-sweep.yml` on
   `schedule: - cron: "* * * * *"` (GitHub's minimum effective cadence is ~5 min;
   accept that, or use cron-job.org for true 1-min) that does
   `curl -sf -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" https://<prod-domain>/api/cron/payment-sweep`.
   Add `CRON_SECRET` to the repo's Actions secrets.
3. In `payment-schedule.ts`, make the schedule **time-based, not attempt-count
   based**: derive the current stage from elapsed time since publish (pre-mempool)
   or since `mempool_seen_at` (post-mempool), so a missed or sparse tick doesn't
   burn a stage. Keep the same delay tables as the boundaries.
4. In the sweep route, add `.order("next_check_at", { ascending: true })`, include
   `overdue` in the status filter (M-DB-2), loop until the due queue drains
   (paginate past `BATCH_SIZE`), and add `export const maxDuration = 60`.
5. Update the route header comment, the README latency claims, and the v1.4.1
   roadmap note to describe the external-cron reality.

**Done when:** an abandoned testnet invoice (payer closes the tab) transitions
`pending → payment_detected → paid` within minutes via the external scheduler,
with no dependence on `stage_attempt` exhaustion, and overdue invoices still get
checked.

### S4 — DB defends money state (branch `fix/db-money-invariants`)
Findings H-DB-1, H-DB-2. One migration.

Steps (new migration, add constraints `NOT VALID` then validate):
1. `amounts_non_negative` (subtotal/tax/total ≥ 0); `tax_percent_range` (0-100);
   `currency_whitelist` (start `('USD')`, widen when v2.12 lands);
   `totals_consistent` (`total_fiat = round(subtotal_fiat + tax_fiat, 2)`).
2. `line_items` shape: an `immutable` helper function `line_items_valid(jsonb)`
   asserting array-of-objects with numeric `quantity`/`unit_price`, wired into a
   CHECK.
3. Immutability trigger: block UPDATE of `total_fiat`/`subtotal_fiat`/`tax_fiat`/
   `line_items`/`currency`/`btc_address` when `old.status in ('paid','payment_detected')`.
4. Delete-guard trigger: `raise exception` on DELETE when `old.status <> 'draft'`.
5. Add a status guard to `bulkDelete` in
   `src/app/(dashboard)/invoices/bulk-actions.ts` (draft-only) so the UI matches.
6. Reconcile any existing rows that would violate the new constraints *before*
   `VALIDATE` — report them, don't blind-delete (contrast the 0018-0020 pattern).

**Done when:** a PATCH to a paid invoice's `total_fiat` is rejected by the DB, a
non-draft delete is rejected, and negative/ inconsistent amounts cannot be
written.

**End of Phase 0 = safe to run on mainnet and invite users.** Before flipping
`NEXT_PUBLIC_BTC_NETWORK=mainnet`, do the outstanding **mainnet dry-run** (publish
an invoice to a real receive address, pay a small real amount, confirm the full
`pending → payment_detected → paid` flow through the external cron) — this has
never succeeded and is the single highest-risk unverified path.

---

## PHASE 1 — Correctness and hygiene (before real volume)

Order within the phase is flexible; each is its own branch.

- **v1.4.x/detection-robustness** — M-DB-1 (cron CAS `.select("id")` + skip side
  effects on empty; optional unique index on `email_events`), M-DB-3 (`markUnpaid`
  / `bulkUnarchive` reset schedule columns + clear `btc_txid`), remainder of
  M-MONEY-2 (the client-crash / dead-poll-loop half already shipped 2026-07-27 —
  `fetchAddressTxs` now try/catches and returns `[]`; still needed here: give the
  cron a way to tell "mempool.space is down" apart from "no tx yet" so an outage
  doesn't burn a `stage_attempt`, plus `AbortSignal.timeout`. See the M-MONEY-2
  update in Appendix B),
  M-MONEY-3 (pick confirmed-then-unconfirmed tx), M-MONEY-5 (freshness fails
  closed). Also the mempool.space client WebSocket in `payment-watcher.tsx` never
  reconnects after a close/error (its `onclose` is an intentional no-op), so the
  fastest detection path dies for the rest of the page load once mempool.space
  drops the socket — add bounded reconnect/backoff. And the M-MONEY-4 remainder:
  a seen tx that disappears (RBF/eviction) leaves the invoice stuck in
  `payment_detected`; add a bounded revert-to-pending. Bundle these — they all
  touch the detection path.
- **v1.4.x/rls-and-indexes** — M-DB-4 (`pre_archive_status` → enum + CHECK),
  M-DB-5 (enumerate the view's columns), M-DB-6 (`user_id` index + wrap
  `auth.uid()`), M-DB-7 (webhook dedupe: `23505`-only + retention sweep),
  `email_events.updated_at` trigger, `(user_id, invoice_number)` uniqueness.
- **fix/proxy-and-boundaries** — H-FE-2 (`proxyConfig` → `config`), H-FE-4 (root
  `error.tsx` + `not-found.tsx`, dashboard/invoice `loading.tsx`), M-FE-4 (proxy
  `getSession` → `getUser`), M-FE-5 (security headers in `next.config.ts`).
- **fix/public-endpoint-hardening** — H-SEC-1 (access-code check on the public PDF
  route), M-FE-6 (cap `line_items` length, cache PDF by `updated_at`), the
  `btc-price` currency allowlist, `timingSafeEqual` for `CRON_SECRET`, `secure`
  cookie flag.
- **fix/rate-limiting** — H-SEC-2 + H-SEC-3 + M-FE-6 abuse surface. Vercel WAF
  rate-limit rules give immediate coverage with no code (access-code verify, email
  send, PDF route); add server-side `client_email` validation and a per-user daily
  send cap; enforce a minimum access-code length and store a hash.

---

## PHASE 2 — Structural single-sources-of-truth (pays for itself over time)

- **A-1: Generate Supabase types** (branch `chore/supabase-types`). H-FE-5. Run
  `supabase gen types typescript` into `src/lib/database.types.ts`, thread the
  `Database` generic through `server.ts`/`client.ts`/`admin.ts`, derive the
  `Invoice`/`InvoiceRow` types from it, delete the hand-declared duplicates. Add a
  hook/CI step so the file regenerates on migration change.
- **A-2: Adopt Zod + typed action results** (branch `refactor/zod-validation`).
  H-FE-3, M-FE-2. Introduce one `invoiceSchema` in `src/lib/invoices/schema.ts`
  imported by both `invoice-form.tsx` and the server actions; convert action
  validation errors from thrown strings to `{ ok: false, field, message }` return
  values; collapse the form's three parallel arrays into one `LineItemState[]`.
- **A-3: Unify realtime + styling sources of truth** (branch
  `refactor/realtime-and-styling`). M-FE-3 (one `useInvoiceChannel` hook with
  bounded resubscribe on terminal states), M-MONEY-4 partial (document reorg risk),
  and pick one color source of truth (derive `brand-colors.ts` from the CSS tokens
  or add a test that parses `globals.css`). Do the styling half opportunistically
  during v1.5.
- **A-4: Integration test layer** (branch `test/supabase-integration`). M-FE-1,
  H-FE (PRD promise). Stand up the promised integration suite against a real
  Supabase test instance, starting with address-uniqueness (H-DB-3) and status
  transitions — exactly where the chain mocks are weakest. Fix H-DB-3 here (the
  `security definer` boolean RPC + `23505` catch for a friendly message).

---

## PHASE 3 — Product roadmap resumes

Once Phase 0-1 are green, resume the existing `ROADMAP.md` queue. The remaining
UX/feature items (v1.4.20 auto-overdue emails, v1.4.21 watcher dedup, v1.4.22
activity feed, v1.4.23 marketing landing page [launch-blocking], v1.4.24 row-action
availability, v1.4.25 duplicate cleanup, v1.4.26/27 email rework, then v1.5 design
system, v1.6 BTC discount, v1.7 address fields) are well-specified and unchanged by
this audit — proceed with them as written. v1.4.19 and v1.4.28 are absorbed into
Phase 0 above (S2, S3); mark them done there. The v2 growth block stays deferred.

---

## Roadmap & docs restructure (do alongside Phase 0)

1. **Split ROADMAP.md** (M-PROC-1). Move every ✅ section (v1.0 through v1.4.18,
   ~lines 20-1370) into a new `development/ROADMAP-ARCHIVE.md` verbatim. Leave in
   `ROADMAP.md`: the legend, a ~15-line "shipped so far" index table (version /
   one-line / PR# / date), the 🔄 and ⏳ sections in full, v1.5-v1.7, the v2 block,
   Notes, and the Pre-deployment Checklist. Target under 500 lines. Update
   `next-feature`'s step 1 to read only `ROADMAP.md`.
2. **Fix stale markers** (M-PROC-3): flip v1.4.14.1/.2/.3 to ✅; tick the
   done-but-unchecked test boxes in merged sections.
3. **One tracker for outstanding verifications** (M-PROC-2): new
   `development/OUTSTANDING-VERIFICATIONS.md` listing the mainnet dry-run (launch
   blocker), v1.4.18 TESTS 3/6/7, and the Resend-webhook prod config, each with
   status and blocking-for. Add a `manual-tests/README.md` index.
4. **Banner PRD.md** (M-PROC-4) as historical/superseded; finish the rename
   (M-PROC-5) in PRD.md and the one live ROADMAP line, and extend
   `rename-to-satsend.test.ts` to cover `development/`.
5. **Add `.env.example`** at root (and `!.env.example` to `.gitignore`) with every
   var one-line-commented: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
   `EMAIL_FROM`, `CRON_SECRET`, `RESEND_WEBHOOK_SECRET`, `NEXT_PUBLIC_BTC_NETWORK`
   (flag this one — the mainnet detection failure was caused by it pointing at
   testnet), and the site-URL var.
6. **Fix version identity** (H-PROC-1): set `package.json` to `1.4.18`, backfill a
   `v1.4.18` tag on merge commit `6af7c73`, and add "bump + tag on merge" to the
   git-workflow skill.
7. **Repo hygiene**: `git rm --cached` the committed `.DS_Store` files; delete the
   stale `master` branch (local + origin) after confirming it's behind `main`;
   prune merged feature branches; note preserved-WIP branches in ROADMAP Notes.

---

## Claude Code workflow: recommended new hooks & skills

The current setup is good (the `next-feature` planning gate and the migration
nudge are the right instincts). For a solo dev shipping a money app with a weaker
model, add these — they convert "the model remembered" into "the harness
enforced."

**Hooks** (in `.claude/settings.json`):
1. **test-must-pass gate on `git commit`** — block/warn unless `npm run test:run`
   and `npx tsc --noEmit` exited 0 since the last edit. Highest value; the entire
   quality gate is currently the model remembering to run tests.
2. **typecheck-on-Stop** — run `npx tsc --noEmit` on Stop and surface failures, so
   a session never ends green-looking with a broken build.
3. **version-sync on `gh pr create`** — verify `CHANGELOG.md` has the branch's
   version and `package.json` matches. Closes H-PROC-1 permanently.
4. **roadmap-size tripwire** — warn when `ROADMAP.md` exceeds ~40KB, so the archive
   discipline self-enforces.

**Skills**:
5. **pre-merge-verification** — run the full gate (tests, typecheck, lint, the
   rename guard, grep for stray `console.log`/`.only`, CHANGELOG entry present,
   manual-test doc exists) and emit a pass/fail table before every `gh pr create`.
6. **migration-safety** — codify the 0018/0019 lessons: next number = max+1,
   `NOT VALID` + validate over destructive delete, apply-to-remote-before-PR,
   view drop/recreate for `select *` dependents. (The existing migration nudge can
   trigger it.)
7. **deploy-checklist** — walk the launch checklist + `vercel env` mirror, confirm
   the external cron fired, confirm the webhook endpoint is live, before any prod
   promote.

Also: shrink the two overlapping items — have `write-a-prd` invoke `grill-me`
rather than restating it — and put a 20-30 line project brief in `CLAUDE.md`/
`AGENTS.md` (run `npm run test:run` + `npx tsc` before any commit; migrations
applied to remote before PR; versions come from `ROADMAP.md`; never touch main).
Keep it short — don't recreate the roadmap context problem.

---

## Appendix B — Findings reference (folded in from the former ARCHITECTURE-AUDIT-2026-07.md)


Senior-engineer review of the whole project: code, schema, security, frontend,
tests, roadmap, docs, and the Claude Code workflow. Findings are grouped by
severity. Every CRITICAL and HIGH item was traced to specific files; the
highest-stakes ones were independently found by more than one reviewer and then
re-verified by hand against the source.

**Context for this audit:** SatSend is a serious side project, pre-launch, on
testnet only. No real BTC has moved yet. That is the one piece of good luck
running through this whole report: the money-critical bugs below are all fixable
*before* anyone can be hurt by them. They must be fixed before mainnet.

The step-by-step plans for every actionable finding here are in Appendix A at
the end of this file.

---

## 1. The headline: four ways the entire database is exposed, plus one payment-forgery bug

These five are the reason this audit exists. Each is independently exploitable by
anyone who opens the site and reads its JavaScript. Four are one-line-ish
database fixes. They should ship in a single migration before anything else.

### CRIT-1 — `invoice_email_summary` view bypasses RLS and is world-readable
`supabase/migrations/0012_invoice_email_summary.sql:17`

The view is created without `security_invoker`, so Postgres runs it as its owner
(`postgres`, which has `BYPASSRLS`), and Supabase's default grants make it
readable by the `anon` role. The header comment claims "RLS is inherited from
the underlying tables" — that is factually wrong for a non-invoker view.

**Exploit:** `GET /rest/v1/invoice_email_summary?select=*` with the public anon
key (which ships in the browser bundle) returns every column of every invoice for
every user — *including drafts* — with `access_code`, `client_email`,
`client_tax_id`, `your_address`, `your_tax_id`, `btc_address`, `btc_txid`, and
email error messages. It is a complete customer + revenue + address-graph dump.

**Fix:** `alter view invoice_email_summary set (security_invoker = on);` plus
`revoke all on invoice_email_summary from anon;`.

### CRIT-2 — `anon_select_non_draft` policy exposes all non-draft invoices
`supabase/migrations/0009_anon_select_for_realtime.sql:13`

`for select to anon using (status != 'draft')` has no per-row predicate. It was
written so one Realtime subscription would work, but an RLS policy is not scoped
to the subscription that motivated it.

**Exploit A:** `GET /rest/v1/invoices?select=*` with the anon key returns every
non-draft invoice — again including `access_code` (defeating the access-code
gate) and every UUID (defeating "the UUID is the secret").
**Exploit B:** an anon client subscribes to `postgres_changes` on `invoices`
with no filter and, because `REPLICA IDENTITY FULL` is set (migration 0006),
receives the full row of every invoice mutation across all tenants in real time.

**Fix:** drop the policy. The public page reads via the service-role admin
client and does not need it. Re-architect the payer-page realtime onto a
server-published broadcast channel (see Appendix A → S1).

### CRIT-3 — `webhook_deliveries` has RLS disabled in a public schema anon can write
`supabase/migrations/0021_resend_webhook_lifecycle.sql:28`

RLS is never enabled; the comment "server-role-only writes, no anon reads" is
false under Supabase's default `GRANT ALL ... TO anon`. Anyone with the anon key
can `SELECT`, `INSERT`, and **`DELETE`** rows. `DELETE FROM webhook_deliveries`
wipes the dedupe table and re-enables webhook replay; mass-insert is a storage
DoS.

**Fix:** `alter table webhook_deliveries enable row level security;` (no
policies needed — the service role bypasses RLS). Audit every other public table
for `relrowsecurity = false`.

### CRIT-4 — Payment-status API trusts the client's "confirmed" claim; no amount check
`src/app/api/invoices/[id]/payment-status/route.ts:62-84` (verified)

The route fetches the real transaction from mempool.space (line 62) — which
carries the true `status.confirmed` — then **discards it** and builds a synthetic
tx whose confirmation state is `status === "paid"` from the *client-supplied
request body* (lines 70-74). The endpoint has no authentication. Combined with
the total absence of amount verification (the synthetic vout hardcodes
`value: 0`, and neither `txPaysToAddress` nor `decidePaymentSchedule` reads
`value`), this is a remote "mark any invoice paid" primitive.

**Exploit:** POST `{txid: <a real 1-satoshi unconfirmed tx to the address>,
status: "paid"}`. `fetchTx` succeeds, `txPaysToAddress` succeeds, the synthetic
tx is marked confirmed, the invoice flips to `paid`, and a "payment confirmed
on-chain" email fires — for zero real payment. The payer then RBFs the 1 sat
back to themselves. Because the cron only re-examines `pending`/`payment_detected`
rows, the false `paid` state is permanent.

**Fix (in order):** (1) use the fetched `tx`, not the synthetic one, so
confirmation comes from mempool.space; (2) verify received sats ≥ expected
(persist `expected_sats` at publish); (3) require a confirmation-depth threshold;
(4) require the access-code cookie so this is a "please check now" hint, not a
command.

### CRIT-5 — The daily cron silently breaks background detection entirely
`vercel.json:3` (verified: `"0 0 * * *"`)

Commit 82aa343 downgraded the cron to daily for Hobby-tier compatibility, but the
whole `next_check_at`/`stage_attempt` schedule in `payment-schedule.ts` was
designed for a per-minute tick. The failure is worse than "slower":

- Every pre-mempool interval (30s…30min) is shorter than 24h, so **every daily
  tick consumes exactly one `stage_attempt`**. The invoice gets one mempool check
  per day for ~7 days, then `next_check_at` is set to null and monitoring
  **stops forever**. A payment made on day 8+ is never detected server-side.
- Confirmation latency after `payment_detected` is likewise up to 24h.
- `BATCH_SIZE = 50` with no `.order()`: under a daily cron everything is due at
  once, so with >50 monitorable invoices an arbitrary subset waits another day,
  repeatedly.
- The README and the route's own header comment still promise "every minute" and
  "p50 < 15s" detection. Those claims are false in production today.

Because CRIT-4's client path is currently the *only* timely detection path, the
forgery bug and the broken cron compound each other.

**Fix (decided):** keep Hobby tier and drive the sweep every minute from a free
external scheduler (GitHub Actions or cron-job.org) using `CRON_SECRET`; also make
the schedule time-based rather than attempt-count-based, add `.order`, and loop
until the due queue drains. This is roadmap item v1.4.28 — promote it.

---

## 2. Everything else that's wrong (by severity)

### HIGH

- **H-SEC-1 — Public PDF endpoint bypasses the access-code gate.**
  `src/app/api/invoice/[id]/pdf/route.ts` has no auth and no cookie check, so the
  access code protects the HTML page and nothing else. Anyone with the UUID gets
  the full rendered invoice (both parties' names, addresses, tax IDs, emails, BTC
  address). Add the same `isAccessCodeValid` cookie check the page uses.

- **H-SEC-2 — Access-code gate is brute-forceable; codes are unconstrained.**
  No rate limiting anywhere in the app. Comparison is non-constant-time. Real
  codes are user-typed (the `generateAccessCode` helper is dead code), only
  lowercased and truncated to 16 chars, with no minimum length — an owner can set
  `1`. Codes are optional, and CRIT-2 hands out the UUIDs for free. Rate-limit by
  invoice+IP, enforce a minimum length, store a hash.

- **H-SEC-3 — Authenticated email send is an unmetered spam/phishing vector.**
  Open signup + magic link + no per-user send quota + `client_email` never
  validated server-side. Mail goes out from the app's DKIM-signed domain with
  attacker-controlled sender/client names in subject and body. (No header
  injection — Resend posts JSON and React Email escapes — the risk is volume and
  brand abuse.) Add server-side email validation and a daily send cap.

- **H-DB-1 — No money-integrity constraints at all.** `total_fiat`,
  `subtotal_fiat`, `tax_fiat` can be negative or mutually inconsistent;
  `tax_percent` allows ±999.99; `currency` is free text (a user can PATCH it to
  anything, and it flows straight into `fetchBtcPrice`); `line_items` JSONB has
  zero shape validation. Stored `subtotal + tax` is not guaranteed to equal
  stored `total`. Add CHECK constraints (`NOT VALID` first, then validate).

- **H-DB-2 — Paid invoices are fully mutable and deletable by their owner.**
  RLS `owner_all` checks ownership only — never status or column immutability. A
  user can `PATCH` a paid invoice's `total_fiat` to 0 via PostgREST with their own
  JWT, and `bulkDelete` has no status guard and cascade-deletes the financial
  audit trail (`email_events`, `invoice_events`). Add immutability + delete-guard
  triggers for non-draft rows.

- **H-DB-3 — Address uniqueness is app-checked per-tenant but DB-enforced
  globally.** `assertAddressUniqueness` runs on the RLS-scoped client so it can't
  see other users' rows, but the unique index is global. Result: (a) publishing
  an address another user already uses passes every app check then throws a raw
  Postgres error at the UI, and (b) that distinguishable failure is a cross-tenant
  oracle for "is this BTC address registered on the platform." Use a
  `security definer` RPC returning a boolean, and catch `23505` for a friendly
  message.

- **H-FE-1 — Test suite is RED on main.** 5 tests in `actions.test.ts` fail
  because a fixture `due_date = "2026-07-10"` is now in the past, so publish flips
  to `overdue` and the assertions expect `pending`. They started failing silently
  on 2026-07-10 with no code change. A red suite masks all future regressions.
  Use `vi.setSystemTime()` (as `payment-schedule.test.ts` already does correctly).

- **H-FE-2 — Proxy route matcher is silently ignored.** `src/proxy.ts:49`
  exports `proxyConfig`; Next 16 recognizes `export const config`. So the matcher
  never applies and the auth proxy (which constructs a Supabase client and calls
  `auth.getSession()`) runs on *every* request including static assets. Rename to
  `export const config`.

- **H-FE-3 — Server-action validation errors won't survive production.** Field
  errors are thrown as `Error("btc_address: message")` strings and regex-parsed on
  the client. Next.js masks uncaught Server Function messages in production (the
  project's own bundled docs say to model expected errors as return values). In
  prod, "duplicate address", "address has history", etc. all collapse to a generic
  error and the user can't see why publishing failed. Convert to typed
  `{ ok: false, field, message }` return values (pairs naturally with adopting
  Zod — see A-2).

- **H-FE-4 — No error/loading/not-found boundaries anywhere.** Zero `error.tsx`,
  `loading.tsx`, `not-found.tsx`, `global-error.tsx` in `src/app`. `notFound()` on
  the public invoice URL renders the unstyled framework 404. Add at least root
  `error.tsx` + `not-found.tsx` and dashboard/invoice `loading.tsx`.

- **H-FE-5 — No generated Supabase types; four hand-declared row shapes drift.**
  No `database.types.ts`; the three client factories are untyped so every query
  returns `any`. `Invoice` is declared differently in `invoice-public.ts`,
  `actions.ts`, and `columns.tsx`. A renamed column type-checks fine and fails at
  runtime. Generate types and thread `Database` through the factories.

- **H-PROC-1 — Version identity is broken across three sources of truth.**
  `package.json` says `0.1.0`, CHANGELOG says `1.4.18`, and there are zero git
  tags ever — despite the git-workflow skill mandating a tag per version. No way
  to correlate a deployed build with a roadmap version. Bump package.json, backfill
  tags, and enforce it with a hook.

### MEDIUM

- **M-DB-1 — Optimistic-concurrency check silently passes on 0 rows in the
  cron.** `payment-sweep/route.ts:88` does `.eq("status", inv.status)` but never
  checks whether a row matched, so if the client path transitions the row first,
  the cron's no-op update still proceeds to send duplicate detected/confirmed
  emails. (The fast-path route handles this correctly via PGRST116.) Add
  `.select("id")` and skip side effects on empty. Optionally a partial unique index
  on `email_events (invoice_id, email_type, recipient)` as a hard exactly-once
  backstop.

- **M-DB-2 — Overdue invoices are excluded from background detection.** The
  sweep filters `status in (pending, payment_detected)` but `overdue` is payable.
  The moment the daily sweep flips a row to `overdue`, the cron stops checking that
  address for payment forever; an invoice published already-past-due goes straight
  to `overdue` with a `next_check_at` the sweep will never read. Include `overdue`.

- **M-DB-3 — `markUnpaid` doesn't reset polling state.** It sets only
  `status: "pending"`, leaving `next_check_at` null (was paid) so monitoring never
  resumes, or leaving stale `mempool_seen_at` so the next sweep can flip the row
  back to `payment_detected` with no transaction existing. Reset the schedule
  columns and clear `btc_txid`. Same for `bulkUnarchive`.

- **M-DB-4 — `pre_archive_status` is unconstrained `text`, not the enum.**
  `bulkUnarchive` writes it straight back into the enum column; any stale value
  (e.g. `marked_as_paid` from the reverted 0015 era) throws mid-loop after earlier
  rows committed. The `?? "pending"` fallback can silently downgrade a paid
  invoice. Convert to the enum type + a CHECK.

- **M-DB-5 — `invoice_email_summary` view uses `select i.*`**, freezing the
  column list at creation — any future `add column` silently won't appear, any
  `drop column` fails until the view is dropped (0017/0018 already hit this).
  Enumerate columns or accept the drop/recreate dance.

- **M-DB-6 — Missing index on `invoices.user_id`.** Every RLS check and the
  dashboard's `.eq("user_id", ...)` is a seq scan; `auth.uid()` is unwrapped so
  it's re-evaluated per row. Add `(user_id, created_at desc)` and wrap as
  `(select auth.uid())`.

- **M-DB-7 — Webhook dedupe has two holes.** Any insert error is treated as
  "duplicate" and returns 200 (transient failures silently drop events Svix won't
  retry); the dedupe row is inserted before `email_events` is updated, so a fast
  `delivered` webhook can permanently block the row. Check for `23505`
  specifically; add a retention sweep.

- **M-MONEY-1 — BTC amount is quoted at view time and never locked.** Two
  viewers (or one across a refresh) can see different BTC amounts; nothing records
  what the payer was actually asked to pay, so disputes are unresolvable and
  amount verification (CRIT-4 fix) has no reference value. Snapshot
  `btc_amount_sats`/`price`/`quoted_at` at publish or first reveal.

- **M-MONEY-2 — mempool.space failures are swallowed as "no transactions".**
  `fetchAddressTxs` returns `[]` on any non-OK response and has no timeout
  (unlike `btc-price.ts`). In the cron, an outage looks identical to "not paid",
  so `stage_attempt` still increments and can exhaust the schedule during an
  outage. Make it throw/return null on failure and don't consume an attempt; add
  `AbortSignal.timeout`.
  - **Confirmed 2026-07-27 (manual v1.4.19-H-S2 testing):** the "no timeout"
    half bit the client too. On a real mempool.space outage/unreachability,
    `fetchAddressTxs` had no try/catch of its own — the raw network exception
    (`TypeError: Failed to fetch`) propagated up uncaught, surfacing as an
    unhandled promise rejection (a Next.js dev-overlay "Runtime TypeError") in
    the browser. Worse, in `payment-watcher.tsx`'s `scheduleActivePoll`, the
    `setTimeout` callback does `await checkRestAndUpdate(); scheduleActivePoll();`
    — the throw skipped the second call, so the active-poll loop **permanently
    stopped re-arming itself** after a single network blip, for the rest of
    that page load (the WS `onerror` comment claims a "fallback to polling"
    that, post-throw, no longer existed).
  - **Fixed 2026-07-27:** `fetchAddressTxs` now wraps its fetch in try/catch and
    returns `[]` on any failure (network throw or non-OK response alike),
    matching the file's other functions. This closes the client-crash /
    dead-poll-loop symptom above. **Still outstanding, deferred to v1.4.22-H**:
    the cron can't yet tell "mempool.space is down" apart from "no transactions
    yet" (both now read as `[]`), so an outage during the cron's pre-mempool
    phase still silently burns a `stage_attempt` instead of being retried
    without penalty — that part needs the scheduler-level change (return
    null/throw distinctly to the cron, don't consume an attempt on failure,
    add `AbortSignal.timeout`), not just the try/catch.
  - **Confirmed 2026-09-28 (manual v1.4.19-H-S2 testing):** the mempool.space
    WebSocket in `payment-watcher.tsx` (a separate socket from the Supabase
    Realtime channel) has an `onclose` that deliberately does nothing. Once
    mempool.space drops that connection — routine on testnet, and visible in the
    dev log as `[PaymentWatcher] WebSocket error, falling back to polling` — the
    fastest detection path stays dead for the rest of that page load; the comment
    claims a "fallback to polling" but the socket is never re-opened. Fold a
    bounded reconnect/backoff into **v1.4.22-H**, alongside the M-MONEY-4
    remainder below (bounded revert-to-pending when a seen tx disappears).

- **M-MONEY-3 — `decidePaymentSchedule` picks the first paying tx, not the
  best.** mempool.space returns unconfirmed first, so a dust tx alongside a
  confirmed real payment leaves the invoice stuck in `payment_detected`. Search
  confirmed first, then unconfirmed (and prefer the amount-matching tx).

- **M-MONEY-4 — RBF/eviction leaves invoices stuck in `payment_detected`
  forever**, and 1-conf → paid has no reorg handling. Both undocumented. Add a
  bounded revert-to-pending on repeated misses; document the 1-conf reorg risk.

- **M-MONEY-5 — Address freshness check fails open.** `assertAddressFreshness`
  skips the reuse check with a console warning when mempool.space is unreachable,
  so an address with prior history can pass publish and its old tx immediately
  flips the new invoice to paid. Fail closed, or flag "freshness unverified".

- **M-FE-1 — Brittle Supabase chain mocks.** Tests dispatch on the literal
  `select()` column string, so reordering columns breaks tests with no behavior
  change. Build one shared typed query-builder fake; stand up the PRD-promised
  integration suite for the query layer (it does not exist — all 40 test files are
  unit tests over mocks).

- **M-FE-2 — `invoice-form.tsx` is 683 lines with three index-synced arrays**
  (`line_items`, `rawAmounts`, `itemKeys`) mutated in four places each; one missed
  parallel update reorders prices against descriptions. No schema-validation
  library anywhere in the repo. Collapse to one `LineItemState[]` and a shared Zod
  schema imported by both form and server action.

- **M-FE-3 — Realtime hooks duplicate lifecycle logic and don't reconnect.**
  Two near-identical hooks diverge subtly and neither handles
  `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` beyond `console.warn` — a dropped channel
  stays dead until remount. Extract one `useInvoiceChannel` with bounded
  resubscribe.

- **M-FE-4 — Proxy uses `getSession()` not `getUser()`.** Server-side
  `getSession()` trusts the cookie without revalidation; the redirect decision is
  spoofable (the layout backstops with `getUser()`, so this is defense-in-depth,
  but the proxy is the wrong place to trust a cookie).

- **M-FE-5 — No security headers.** `next.config.ts` sets none — no CSP,
  `X-Frame-Options`, `Referrer-Policy`, HSTS. The public payer page is framable,
  making "Mark as Payment Sent" clickjackable. Add a `headers()` block.

- **M-FE-6 — Unauthenticated PDF generation is a CPU DoS** (react-pdf on every
  request, no cache, no rate limit) amplified by unvalidated `line_items` (create
  one invoice with 100k line items, hammer the public PDF URL). Cap array length,
  cache by `updated_at`, rate-limit.

- **M-PROC-1 — ROADMAP.md is a 63k-token context bomb.** ~68% is completed
  history with full specs and SQL, and two skills (`next-feature`,
  `roadmap-progress`) re-read it every session. Split completed sections into
  `ROADMAP-ARCHIVE.md`.

- **M-PROC-2 — Deferred verifications have no reliable home.** The v1.4.1
  mainnet dry-run (never succeeded — the single highest-risk unverified path in a
  BTC product), v1.4.18 TESTS 3/6/7, and the v1.4.18 Resend-webhook prod config
  each live in a different file. Consolidate into one tracked list and mark the
  launch-blockers.

- **M-PROC-3 — Stale roadmap markers.** v1.4.14.1/.2/.3 are 🔄 but merged
  (PRs #31-33); several ✅ sections have unchecked test boxes. A weak model can't
  tell "done but not ticked" from "not done".

- **M-PROC-4 — PRD.md is dead documentation.** Still titled "Paybitty", still
  describes auto-generated codes, `tax_fiat`, the login sweep, and lists PDF
  download as out of scope (all superseded). Any session reading it as ground
  truth is misled. Banner it as historical.

- **M-PROC-5 — Rename to SatSend is incomplete.** PRD.md, one live ROADMAP line,
  and the Supabase project name still say Paybitty. The
  `rename-to-satsend.test.ts` guard deliberately doesn't cover PRD.md.

### LOW (do in passing)

- `CRON_SECRET` compared with `!==` (use `timingSafeEqual`); auth-callback `next`
  param allows any internal path (not an open redirect, but harden to `/`-prefixed);
  access cookie lacks `secure`; `btc-price` currency param has no ISO-4217
  allowlist; `admin.ts` lacks `import "server-only"` and `invoice-payment-view.tsx`
  value-imports a type from it (elided today, one refactor from leaking the service
  key); full invoice row (incl. `access_code`, `user_id`) serialized to the payer's
  browser; `.DS_Store` committed under `.claude/skills/`; dual `main`/`master`
  branches + 40 stale local branches; no `.env.example`; `@types/qrcode` in
  `dependencies`; lint exits 1 (`columns.tsx:59` display-name); `Math.random()` in
  the dead `generateAccessCode`; no `(user_id, invoice_number)` uniqueness;
  `email_events.updated_at` has no trigger; `config.toml` pins Postgres 15 while
  hosted defaults to 17 and leaves signup open with no rate-limit block.

---

## 3. Architecture, grilled

**The good bones.** The instinct to extract pure, side-effect-free logic with
injected clocks is genuinely strong: `payment-schedule.ts`, `overdue-actions.ts`,
`can-publish.ts`, `pdf-filename.ts` are all testable in isolation and well-covered
at their boundaries. BTC address validation is real cryptographic checksum
validation (bech32/bech32m/base58check), not a regex. The server-action / API-route
split is principled (actions = authed owner mutations + the progressive-enhancement
public form; routes = callers that can't invoke actions: the unauth watcher, cron,
the svix webhook, binary PDFs, the price proxy). Money is `numeric(12,2)`, never
float — the single most common invoicing-schema mistake, avoided from migration
0001. RLS is enabled on every user-scoped table from creation, and the event tables
are correctly write-only-via-admin. The Resend webhook is the best-built endpoint in
the app (raw-body HMAC verify, all three headers required, DB-backed replay dedupe,
a status-precedence table so a late `delivered` can't overwrite a `bounced`). And
every one of the 15 dashboard server actions is correctly authorized with an
explicit `user_id` check *and* the RLS-scoped client — not one relies on RLS alone,
not one uses the admin client. That is the strongest part of the codebase.

**Where the architecture is actually wrong, not just buggy.** The recurring flaw is
a **single trust boundary assumed to hold in three places where it doesn't.** The
mental model is "the invoice UUID is the secret and the service-role admin client is
the only reader." But PostgREST and Realtime are separate front doors that never run
the page's cookie gate, and the anon key is public. So every place that leaned on
"the app checks it" (the anon RLS policy, the non-invoker view, the RLS-off webhook
table, the client-trusting payment endpoint) is bypassable. The fix isn't spot
patches — it's adopting the principle that **the database is a public API and must
defend itself**: RLS/grants scoped per-row, views as `security_invoker`, money
invariants as CHECK constraints, paid rows immutable at the DB, and the payment
endpoint treated as an untrusted hint that triggers server-side verification rather
than a state-transition command.

**The second structural theme is drift from missing single-sources-of-truth.** Row
types are hand-declared four times and can silently diverge from the schema (no
generated types). Validation lives in scattered hand-rolled regexes duplicated and
divergent between client and server (no Zod). Brand colors exist in three mechanisms
(CSS tokens, inline-style workarounds, a hand-maintained hex mirror). The BTC amount
has no locked value. Version identity has three disagreeing sources. Each of these is
a place where two representations of one fact are maintained by hand and *will*
drift — several already have.

**Stack choices are sound.** Next 16 App Router + Supabase + Vercel + mempool.space +
Resend is a coherent, low-cost, non-custodial stack that fits the product. `tsc` is
clean under `strict`. The choice to keep invoices fiat-denominated with BTC as the
rail is right. Nothing here calls for a rewrite — the foundation is good and the
remediation is surgical.

---

## 4. What's working well (keep doing this)

- **Pure-logic extraction with injected clocks and boundary tests** — the model
  to extend, not fix.
- **Real cryptographic BTC address validation** with negative tests.
- **Correct authorization on every dashboard action** — explicit `user_id` +
  RLS-scoped client, never admin, never RLS-alone.
- **The Resend webhook**: HMAC verify, replay dedupe, status-precedence table.
- **Money as `numeric(12,2)`** from day one; RLS on every user table from creation;
  event tables write-only-via-admin.
- **Optimistic CAS on the fast-path payment route** (`.eq("status", prev)` +
  PGRST116) — correct, just needs applying consistently.
- **Spec quality of the upcoming roadmap** (v1.4.19-28): locked decisions, schema
  SQL, named files, enumerated tests, out-of-scope fences — among the most
  weak-model-ready specs one could ask for.
- **Process discipline**: 38 PRs, branch-per-version, zero direct commits to main,
  Keep-a-Changelog format 36 versions deep, per-release manual-test guides, honest
  in-spec deviation notes, decision records embedded in the roadmap.
- **The `next-feature` planning gate** (plan → stop → await approval, with a
  mandatory scope critique) is exactly the right adaptation for driving a weak
  model, and the migration-nudge hook + `supabase-migrate` pairing is a good
  instinct.
- **`rename-to-satsend.test.ts`** — a self-excluding permanent regression guard.
- **Excellent migration comments** — this audit was possible largely because of
  them.
