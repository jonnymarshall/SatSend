# SatSend — Roadmap Archive

> **Historical record.** The completed **v1.0 – v1.4.18** build, moved verbatim
> out of [`ROADMAP.md`](./ROADMAP.md) on 2026-10-07 to keep the live roadmap
> readable. Nothing here is pending. For what shipped recently and what is next,
> read `ROADMAP.md`. The old product name appears here because this text is kept
> verbatim.

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

---

## Archived 2026-10-10 (moved verbatim from ROADMAP.md)

> Finished (✅) and superseded sections moved out to keep the live roadmap small.
> v1.4.23 (Marketing Landing Page) is superseded by v1.5.2-H, which absorbs its
> scope; v1.4.19 and v1.4.28 were already superseded by v1.4.19-H and v1.4.28-H.

### ✅ v1.4.36 — Test automation harness
**Branch:** `chore/test-automation` · **closed in v1.4.34** — the only remainder
(the on-chain testnet wallet sweep) is tracked in
`development/OUTSTANDING-VERIFICATIONS.md`.

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

---

#### ✅ v1.4.19-H (S0) — Green the build
**Branch:** `fix/green-the-build` · Detail: Appendix A → S0
The test suite is red on `main`: 5 tests in `actions.test.ts` fail because a
fixture `due_date` (2026-07-10) is now in the past, and lint exits 1
(`columns.tsx:59`). Freeze time in the test with `vi.setSystemTime`, fix the
display-name lint error. Nothing else proceeds on a red suite.
**Done when:** `npm run test:run`, `npx tsc --noEmit`, `npm run lint` all exit 0.

---

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

---

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

---

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

---

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

---

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

---

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

---

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

### ⏳ v1.4.23 — Marketing Landing Page — SUPERSEDED by v1.5.2-H

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

### ✅ v1.5.0-H — Internal UI kit (`/styleguide`) before the redesign

**Branch:** `v1.5/ui-kit` · package `1.5.0`

Split out of v1.5 (decided 2026-10-08): build a temporary, internal component
library first so the whole Signal Amber system can be judged on one page before
any live screen changes. Kit first, apply second: different risks, different review
styles, and the kit is disposable.

- [x] Signal Amber tokens copied verbatim from the handoff into
      `src/styles/signal-amber.css`, **scoped** to `[data-theme="signal-amber"]` so
      the live dark app is untouched; drift test against
      `satsend-brand-handoff/design-tokens.css`.
- [x] Onest loaded (next/font) alongside Geist, kit-only for now.
- [x] Gated route `/styleguide`: 404 unless `SHOW_UI_KIT=1`, `noindex`, unlinked.
- [x] Primitives in `src/components/signal/` (Button, Field, Card, StatusBadge) and
      the supplied logo in `src/components/brand/` (handoff copy plus the one
      decided spacing change, tested).
- [x] Catalogue: logo, colour, type scale, spacing/radius/elevation, components
      in all states, product patterns (list, stats, empty, table, payer page),
      a marketing composition (nav, hero, footer), and a computed contrast audit.
- [x] Mobile checked at 390px (no overflow; 44px targets).

**Review decisions (2026-10-09, from `manual-tests/v1.5.0-H-ui-kit.md`).** Recorded
in `src/lib/design/adopted-tokens.ts` + `src/styles/signal-amber.css`; the handoff
folder stays untouched as the designer's record.
- **Status text:** AA shades (`--color-*-text`); dots and fills keep the spec colour.
- **Payment detected → violet** `#8B5CF6` / soft `#F3EFFE` (override of `#6E7CF6`,
  which read as the same blue as Pending). Matches the brief's "violet".
- **Pending:** stays "Sent" blue, label "Pending". `archived`: neutral, outlined.
- **Links:** ink text with an amber underline (spec amber text was 2.35:1).
- **Hero amber line + input focus border:** `--color-brand-strong` `#BC8925` (3:1).
- **Input outline:** `--color-border-strong` `#949495` (3:1).
- **Logo:** `.me` `dx` is `1.5` (handoff `-1.5`), so the d→dot gap equals dot→m.
- **Fixed:** inputs flashed red on focus (the old base style's red ring colour
  animated into amber).

**Deletion:** the `src/app/styleguide/` folder is deleted at the end of v1.5.2-H
(moved from v1.5-H on 2026-10-10)
(tracked in `OUTSTANDING-VERIFICATIONS.md`). Primitives, tokens, logo and the
contrast helper are keepers and get promoted.

---

### ✅ v1.5-H — Full Site Redesign, in-app screens (Brand Handoff — "Signal Amber", Option D)

**Branch:** `v1.5/redesign` · package `1.5.2`

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
- Not green-led. Green = success/Paid; violet (`#8B5CF6`, decided v1.5.0-H) =
  Payment detected; blue = Sent/Pending;
  warning orange = Underpaid; red = Overdue.
- Bitcoin visual explicitness ≈ 2–2.5 / 5.

**Split (decided 2026-10-10).** v1.5 is delivered in three slices so each review
stays a manageable size: **v1.5-H** in-app screens (this section), **v1.5.1-H**
emails + PDF, **v1.5.2-H** marketing page. The `/styleguide` kit is deleted at the
end of v1.5.2-H (not v1.5-H) so it stays available as the reference while emails
and the marketing page are restyled. The dashboard is **restyled only**; a layout
rework is out of scope.

**Scope (v1.5-H)**
- [x] Load Onest + Geist Sans in the root layout; Signal Amber tokens are global
      (`:root`); the near-black + red `#DE3C4B` palette is retired. shadcn's
      variables (`--background`, `--primary`, ...) alias the tokens.
- [x] Light/dark: **decided 2026-10-08 — light-first, retire dark.** The `dark`
      class is removed from the root layout and every `dark:` class is gone.
- [x] Promote the v1.5.0-H keepers: Signal Button/Input/Card/StatusBadge replace
      `src/components/ui/button` + `input` (deleted); dropdown, popover, alert
      dialog, calendar, checkbox and table restyled in place.
- [x] `brand-colors.ts` mirrors `signal-amber.css` (drift-tested). The PDF picks up
      ink text and the AA amber `#926D28` for accents; its layout is v1.5.1-H.
- [x] App shell: header with the `SatSendLogo` component, loading spinner, error
      and 404 screens.
- [x] App icon: the handoff's dark favicon mark, with its "S" converted to the real
      Onest 800 outline (`scripts/brand/outline-mark.py`) so it renders without
      the font: `src/app/icon.svg`, `apple-icon.png` (180, full-bleed),
      `favicon.ico` (16/32/48).
- [x] Screens, neutral first then amber: login, invoice list + table, invoice
      form (new/edit), invoice detail (actions, activity), public payer page and
      access-code gate. Status colours exactly as locked above.
- [x] Mobile at 390px: no horizontal page scroll; 44px touch targets on phones.
- [x] Contrast pass on the real screens: all text meets WCAG AA.

**Coordinates with:** Appendix A → A-3 (realtime & styling unification) — its
styling half lands here, not separately.

**Found, not fixed here:** the invoice form logs a dnd-kit hydration warning
(`aria-describedby="DndDescribedBy-N"` differs between server and browser). It is
harmless and predates this branch; the fix is a stable `id` on `DndContext`.

**Done when:** every in-app surface renders in the Signal Amber system, the logo is
the supplied component, the status-colour mapping is exactly as locked above, and
an accessibility pass is clean.

---

## v1.5.x — Redesign follow-ups and fixes (archived 2026-10-21)

> Moved verbatim from `ROADMAP.md` to keep it under its size limit.

### ✅ v1.5.0.5-H — Statuses only update when an invoice is opened (**HIGH PRIORITY**)

**Branch:** `v1.5.8/status-refresh` · package `1.5.8` · **Reported by Jonny,
2026-10-12:** invoices sat on "Payment detected" in `/invoices` and only flipped
to Paid (and only then sent the confirmation email) when he opened the invoice.
"This is an ongoing bug." Do this before v1.5.1.3-H and the marketing homepage.

**Diagnosis (2026-10-12):** three separate gaps, which together mean the only
thing that reliably moves an invoice forward is someone having its page open.
1. **Production's background checker barely runs.** `.github/workflows/payment-sweep.yml`
   asks GitHub for every 5 minutes, but GitHub delays and drops scheduled runs on
   busy/free runners: the last 12 runs (2026-10-10 → 10-12) were **3–6 hours
   apart**. So a detected payment can wait hours for its confirmation and email.
2. **Local dev has no background checker at all**, by design: the scheduler only
   calls production, and "one writer per database" keeps production's sweep off
   the test database. Locally, only the open invoice page (`PaymentWatcher` →
   `/api/invoices/[id]/payment-status`) checks the blockchain.
3. **`/invoices` never asks for a check.** It only listens (realtime, plus
   `router.refresh()`) for changes something else makes, so with (1) and (2) it
   shows stale statuses until someone opens the invoice.

4. **(Found while fixing)** the pre-payment watch **stopped ~48 minutes after
   publish** (`PRE_MEMPOOL_DELAYS_MS` "then stop"), leaving `next_check_at` null,
   so the sweep never looked at an invoice paid later than that, however often
   it ran.

**Done on the branch (code)**
- [x] **One per-invoice check** (`src/lib/invoices/check-invoice-payment.ts`),
      moved out of the sweep: same decision, same optimistic-concurrency write,
      same emails. The sweep and the list check both call it.
- [x] **`/invoices` checks what it shows:** `POST /api/invoices/check-payments`
      (owner-only; up to 10 waiting invoices per call, payment detected first;
      30s per-owner cooldown; writes only on a status change so it never nudges
      the sweep's schedule or fires needless realtime events), called by
      `use-check-waiting-payments.ts` 2s after opening, then every 60s while the
      tab is visible, and on returning to the tab.
- [x] **The watch never ends while unpaid:** after the fast stages the
      pre-payment check repeats every 30 minutes. The sweep also puts any
      invoice whose watch had already stopped back on the schedule (one-off in
      practice; no migration needed).
- [x] **Local checker:** `npm run dev:sweep` (`scripts/dev/sweep.mjs`) starts
      `next dev` with `PAYMENT_SWEEP_ENABLED=true` and a throwaway `CRON_SECRET`
      for that process only, calls the sweep every minute, and refuses to start
      unless the app points at the test project (`scripts/dev/sweep-guard.mjs`,
      an allowlist).
- [x] **Fails loudly:** the sweep returns 503 when it cannot read the database,
      so the cron service's failure alerts fire.

**Jonny's steps (at merge)**
- [x] **cron-job.org job** (free account): URL
      `https://satsend.me/api/cron/payment-sweep`, every minute, GET, header
      `Authorization: Bearer <CRON_SECRET>` (the production value in Vercel), 30s
      timeout, email notification on failure. Recorded in
      `OUTSTANDING-VERIFICATIONS.md`. GitHub's workflow stays as the backup.

**Deferred**
- An in-app "last sweep" warning needs a new table (a migration); the cron
  service's failure emails plus the GitHub backup cover it for now.

**Tests**
- [x] List check: owner-only, waiting statuses only, payment detected first, at
      most 10, write-only-on-change, throttled per owner
      (`check-payments.test.ts`).
- [x] Two overlapping checks of one confirmed payment: one status change, one
      confirmation email (`check-invoice-payment.test.ts`).
- [x] Pre-payment watch keeps going (every 30 min, days later); stopped watches
      are rescheduled; 503 on a database read failure.
- [x] `dev:sweep` guard refuses any database but the test project.
- [x] Manual (`manual-tests/v1.5.8-status-refresh.md`): pay a testnet invoice,
      stay on `/invoices`, and see Payment detected → Paid and the email arrive
      without opening it, locally (`npm run dev:sweep`) and on `satsend.me`.

**Done when:** an invoice moves from detected to paid, and its email is sent,
within a few minutes of confirmation on `satsend.me`, with nobody opening it.

---

### ✅ v1.5.0.6-H — "Send now via email" fails after "Publish only"

**Branch:** `v1.5.9/send-after-publish` · package `1.5.9` · **Reported by Jonny,
2026-10-13:** duplicated an invoice, gave it a fresh address, chose "Publish
only", then "Send now via email" said "This bitcoin address has already been
used on another invoice". The address was unique: the check was finding the
invoice itself.

**Diagnosis:** the three send actions (`publishAndSendEmail`,
`publishAndMarkSent`, and the download variant) always re-ran the full publish
path, even on an invoice that was already published. Since v1.4.31-H the
address check also asks the cross-account RPC `is_address_registered`, which
counts every non-draft invoice and cannot exclude the caller's own row. So any
send after "Publish only" failed. Re-publishing was also wrong on its own: it
reset `status`, `published_at` and the payment schedule.

- [x] Send actions run the publish checks and publish patch only for drafts. On
      a published invoice they write just the send fields (`sent_at`,
      `send_method`, `email_attempted_at`); a failed email attempt keeps an
      earlier manual "sent" mark.
- [x] Tests: published invoice whose own row the RPC reports; payment_detected
      status untouched; no-recipient makes no write; mark-as-sent.
- [x] Manual tests: `manual-tests/v1.5.9-send-after-publish.md` (Jonny,
      2026-10-13: Publish only, then Send now via email, sent and arrived).

---

### ✅ v1.5.0.1-H — Realtime: crash when a live-update channel is re-opened

**Branch:** `v1.5.10/realtime-channel-reuse` · package `1.5.10` (was
`fix/realtime-channel-reuse`) · **Not urgent** (Jonny, 2026-10-10): logged for a future branch.
Dev shows an error overlay that can be dismissed; production only loses live
updates after a dropped connection. Independent of the redesign (realtime code is untouched on
`v1.5/redesign`); found while testing it, 2026-10-10.

**Symptom.** Opening an invoice detail page in dev throws: ``cannot add
`postgres_changes` callbacks for realtime:invoice:<id> after `subscribe()` ``
(`use-invoice-realtime.ts:34` via `use-invoice-channel.ts:85`).

**Cause.** `supabase.channel(name)` (realtime-js 2.103) **returns the existing
channel** when one with the same topic is still registered. `removeChannel()` is
async: the old channel stays registered until the server acknowledges the
unsubscribe. `useInvoiceChannel` creates the new channel without waiting, so any
quick re-open gets the old, already-subscribed channel back, and `.on()` throws.
Three ways to hit it:
1. React Strict Mode mounts effects twice in dev (every detail-page load).
2. Leaving a page and coming straight back.
3. **Production too:** `scheduleReconnect()` calls `removeChannel()` without
   `await`, then `connect()`. After a dropped connection the reconnect throws, the
   error is swallowed as an unhandled promise rejection, and live updates stop
   silently (dashboard list, detail page, and the public payer page all use this
   hook).

**Fix** (all in `src/lib/realtime/use-invoice-channel.ts`):
- [x] In `connect()`, before `supabase.channel(name)`, find any registered channel
      with topic `realtime:${name}` (`supabase.getChannels()`) and
      `await supabase.removeChannel(...)` it.
- [x] In `scheduleReconnect()`, `await` the removal before calling `connect()`.
- [x] Wrap `connect()`'s body in try/catch: log and `scheduleReconnect()` instead of
      leaving an unhandled rejection.
- [x] Tests (fake Supabase client): a stale same-topic channel is removed before
      the new one is set up; a Strict-Mode style mount → unmount → mount does not
      throw; the reconnect path awaits removal; an error in `connect()` schedules a
      retry.
- [x] Found while building: a channel reports `CLOSED` when we remove it, and the
      hook treated that as a new drop, so each reconnect could schedule another
      (a churn loop). Status callbacks from a replaced channel are now ignored.
      If a removal does not clear the topic, `connect()` throws and retries.
- [x] Manual (`manual-tests/v1.5.10-realtime-channel-reuse.md`): open an invoice detail page in dev (no error overlay); publish or
      mark paid in another tab and see the detail page update by itself.

**Not in scope:** two components subscribing to the same topic at once would still
share one channel. Nothing does that today.

---

### ✅ v1.5.0.2-H — Emails land in spam (code side)

**Branch:** `fix/email-delivery` · package `1.5.3` · reported 2026-10-10.

**Report.** An invoice emailed to Jonny's personal address "never arrived". It had
gone to **spam**. The dev log shows Resend accepted every send, so sending works;
the problem is how inboxes judge the email.

**Found (2026-10-10).**
- Sending domain is `mail.satsend.me`: Resend's DKIM (`resend._domainkey.mail`)
  and SPF/MX on `send.mail.satsend.me` are in place.
- **No DMARC.** `_dmarc.satsend.me` holds `v=spf1 include:amazonses.com ~all`, an
  SPF string put on the DMARC name by mistake, so there is no DMARC policy. Gmail
  and Yahoo weigh this heavily.
- **Links don't match the sender.** Emails come from `mail.satsend.me` but link to
  `satsendofficial.vercel.app` in production (`localhost:3000` in dev), and
  `satsend.me` serves no website. Link domains that differ from the sender (and
  shared-hosting domains) are a classic phishing signal, more so on "view and pay"
  invoice emails.
- New domain with no sending reputation yet; invoice + payment + bitcoin wording.
- No email to the sender on publish is expected: that is v1.4.27 (queued).

**Done (code).**
- [x] Every email carries a plain-text version alongside the HTML.
- [x] Client-facing emails (invoice, payer payment detected/confirmed) set
      Reply-To to the invoice owner, so replies reach the freelancer.
- [x] The invoice email shows its link as visible text, not only behind a button.
- [x] The activity card already says "awaiting delivery" until Resend's webhook
      confirms delivery; no change needed.

**Owner actions** (tracked in `OUTSTANDING-VERIFICATIONS.md`): fix the DMARC
record; serve the app on `satsend.me` and point `NEXT_PUBLIC_APP_URL` at it.

---

### ✅ v1.5.0.3-H — Production links pointed at localhost

**Branch:** `fix/app-url` · package `1.5.4` · found 2026-10-10 while checking
production settings for the email work.

**Bug.** Production (Vercel) set neither `NEXT_PUBLIC_SITE_URL` nor
`NEXT_PUBLIC_APP_URL`, so the app's fallback `http://localhost:3000` was used for:
the "View and pay" link in client emails, every other email link, the "Share with
client" link on the invoice page, and the link printed on PDFs. A real client
would have got a dead link. It also made the emails look broken to spam filters.

**Fix.**
- [x] One `getAppUrl()` (`src/lib/app-url.ts`) for emails, PDFs and the share
      link. After the two explicit settings it uses Vercel's own
      `VERCEL_PROJECT_PRODUCTION_URL` on production deploys (the project's custom
      domain, or its vercel.app domain if none), `VERCEL_URL` on previews, and
      localhost only off Vercel.
- [x] Once `satsend.me` is connected in Vercel, links switch to it automatically;
      no setting needed.

---

### ✅ v1.5.1-H — Redesign: emails + PDF

**Branch:** `v1.5.5/emails-pdf` · package `1.5.5` (branch named for the package
version, which the version-sync hook checks).

- [x] **Emails:** all five (invoice sent; payment detected and confirmed, owner and
      payer) rebuilt on one Signal Amber frame (`src/lib/email/templates/layout.tsx`):
      logo, white card on canvas, Onest-style heading, amber button with ink text,
      ink links with an amber underline, inbox preview text. Wording unchanged.
- [x] **Status colours in emails:** a semantic pill (Payment detected violet, Paid
      green, Underpaid orange) from one shared map, `statusColors` in
      `src/lib/brand-colors.ts`, drift-tested against `signal-amber.css`.
- [x] **PDF redesigned** (`src/lib/invoices/invoice-pdf.tsx`), matching the payer
      page: outlined wordmark and invoice number, a "Date Created / Date Due"
      strip, From / Bill to, a calm line-item table, totals (the only place the
      amount appears), and a "Pay with Bitcoin" panel (QR, address, the payment
      link written out, ink with an amber underline). Paid invoices show "Paid in
      bitcoin" with the transaction instead of payment instructions; a detected
      but unconfirmed payment shows the same panel as "Paid in bitcoin
      (unconfirmed)". Every PDF has a "View invoice on SatSend" link under the
      invoice number (number at panel-title size). No status
      badge: a PDF is a snapshot and the status would go stale (Jonny's review,
      2026-10-10). Onest + Geist fonts.
- [x] **Logo files:** font-independent, outlined wordmarks with the decided `.me`
      spacing, drawn from Onest's real glyph outlines with HarfBuzz kerning
      (`scripts/brand/build-brand-assets.py`): `public/brand/satsend-logo*.svg`
      (default, reversed, monochrome) and `satsend-logo-email.png` for emails
      (`scripts/brand/raster-logo.mjs`). Verified pixel-for-pixel against the live
      `SatSendLogo` by overlay. The handoff folder stays untouched.
- [x] PDF fonts: Google Fonts' static files (Onest 700, Geist 400/500/600, Geist
      Mono 400) with OFL licences in `src/lib/invoices/fonts/`, shipped to the PDF
      routes via `outputFileTracingIncludes` in `next.config.ts`.

**Note for future PDF work:** PDFs rendered inside Vitest (jsdom) draw every letter
as a dot and drop images, because react-pdf picks its browser build there. Text
extraction still works, so the tests are valid, but **judge the look from a PDF
served by the dev server**, not from a test run.

---

### ✅ v1.5.1.1-H — App polish from the v1.5.5 test round

**Branch:** `v1.5.6/app-fixes` · package `1.5.6`. Kept apart from the emails/PDF
branch (separate concerns).

- [x] **Logo links home everywhere** (pulled forward from v1.5.2-H): app header,
      payer page, access-code screen and login all use one component,
      `src/components/brand/logo-home-link.tsx`, linking to `/`. Until the
      homepage exists, `/` still redirects to `/dashboard`, so a click lands on
      the invoices (signed in) or login (signed out).
- [x] **Hand cursor on buttons:** Tailwind v4 dropped it; a base rule in
      `globals.css` restores it for every enabled `<button>` and
      `[role="button"]` (the "← Invoices" back button had the arrow cursor).
- [x] **"Marked as sent manually" icon on `/invoices`** is now the paper plane
      (`Send`) used for "Marked as sent" in the invoice's Activity panel, instead
      of `HandHelping`.

---

### ✅ v1.5.1.2-H — Wider email column

**Branch:** `v1.5.7/email-layout` · package `1.5.7`.

- [x] Email column 600px → 720px and the card's side padding back to 28px, so a
      64-character txid fits on one line on desktop instead of wrapping inside a
      narrow "pillar" (Jonny, 2026-10-12, from a Gmail screenshot). On phones the
      txid still wraps; nothing that long fits a phone screen.

---

### ✅ v1.5.1.3-H — Sign-in emails in Signal Amber (confirm signup, magic link)

**Branch:** `v1.5.11/auth-emails` · package `1.5.11`.

**Context (Jonny, 2026-10-12):** the "Confirm your signup" email still uses
Supabase's plain default. Login is passwordless (`signInWithOtp` in
`src/app/(auth)/login/page.tsx`), so a new user gets **Confirm signup** and a
returning user gets **Magic link**. These are the first emails anyone sees from
SatSend, so they come before the marketing homepage. Supabase sends them, not our
code, so the templates live in Supabase's settings, not in `src/lib/email`.

- [x] **One design source:** render the two templates from the same React Email
      frame (`src/lib/email/templates/layout.tsx`) by a script (e.g.
      `scripts/email/build-auth-templates.tsx`), with Supabase's placeholders
      (`{{ .ConfirmationURL }}`) left in, writing `supabase/templates/confirmation.html`
      and `magic_link.html`. Committed, so the look can't drift from our other
      emails. Logo from `https://satsend.me/brand/satsend-logo-email.png`.
- [x] Copy: heading, one sentence, amber button ("Confirm your email" / "Sign in
      to SatSend"), the link written out, "If you didn't ask for this, ignore this
      email." Subjects: "Confirm your SatSend account", "Your SatSend sign-in link".
- [x] `supabase/config.toml`: `[auth.email.template.confirmation]` and
      `[auth.email.template.magic_link]` pointing at the files (local dev).
- [x] **Apply to the hosted projects** (test SatSend-dev, then production SatSend):
      Auth → Email Templates, or the Management API (needs a personal access
      token from Jonny). Record in `OUTSTANDING-VERIFICATIONS.md`.
- [x] **Check who sends them.** Supabase's built-in mailer is rate-limited and
      meant for testing; it sends from a Supabase address, which hurts trust and
      spam scoring. If production still uses it, switch Auth → SMTP to Resend
      (`smtp.resend.com`, sender `SatSend <…@mail.satsend.me>`, so DKIM/SPF/DMARC
      match the invoice emails). Jonny's dashboard step; Claude writes the values.
- [x] Tests: the build script output contains `{{ .ConfirmationURL }}`, the logo
      URL and no `localhost`; a drift test that the committed HTML equals a fresh
      build.
- [x] Manual: sign up with a new address and sign in with an existing one, on
      `satsend.me`; check Gmail inbox (not spam) and "Show original" (DMARC PASS).
      Passed 2026-10-15. On SatSend-dev the first sign-up still got Supabase's default
      (the Confirm sign up template hadn't been saved); fixed and re-tested.

---

### ✅ v1.5.0.8-H — Email logo missing in Proton Mail

**Branch:** `v1.5.12/email-logo-inline` · package `1.5.12` · reported 2026-10-20,
before sending the first real (mainnet) invoice.

**Report.** The "Noaddresstest" invoice email showed a broken-image placeholder
instead of the logo in Proton Mail.

**Found.** The logo URL answers 200 `image/png` to every client tried, and the
Vercel firewall log shows Proton's network (`185.159.157.24`) fetched it twice and
was allowed. So the file reached Proton; Proton refused to show it.

- [x] Embed the logo in every email we send (Resend inline attachment, `cid:`),
      so no email app needs to fetch it. A test checks every send carries it, the
      HTML points at it, and the embedded copy equals the public PNG.
- [x] Supabase sign-in emails keep the web address (they can't carry
      attachments); templates unchanged.
- [ ] Manual (`manual-tests/v1.5.12-email-logo-inline.md`): the logo shows in
      Proton and Gmail.

---

### ✅ v1.5.0.7-H — Sweep: wrong-network addresses re-checked every minute (cron timeouts)

**Branch:** `v1.5.13/sweep-invalid-address` · package `1.5.13`.

**Report (Jonny, 2026-10-15).** cron-job.org sent two "Cronjob failed:
payment-sweep · Last status: Timeout" emails (e.g. 2026-10-14 04:06 GMT), each
followed a minute later by "executed successfully". cron-job.org gives up after
30 s; the route itself may run 60 s (`maxDuration`).

**Found (production, 2026-10-15).** 5 `pending` invoices had been due since
2026-10-13 17:49 and were re-checked on every run: four with **mainnet**
addresses while production watched **testnet**, one with the junk address
`fsgdfbngf`. mempool.space answers 400 for each, `fetchAddressTxs` turned that
into `null`, and the sweep read it as "mempool unreachable", so the schedule never
moved. On a slow mempool.space minute those plus the real checks ran past 30 s.

**Since then (2026-10-20).** Production switched to mainnet for good (testing
stays on testnet4). The four mainnet invoices were found really paid and marked
paid; `fsgdfbngf` and the 13 testnet invoices were archived. Nothing is stuck.

**Decided (Jonny, 2026-10-20).** Check the address against the running network
*before* looking it up, rather than interpreting mempool.space's 400. Log only,
no activity-feed entry (publishing already refuses such addresses). No "skip old
payment emails" rule: late payment emails are true, the flood came from flipping
networks, and production no longer flips.

- [x] `checkInvoicePayment`: a malformed or other-network address stops the
      watch (`next_check_at = null`), logs once, never contacts mempool.space,
      sends nothing (`invalid_address`). The list check only reports it.
- [x] `rescheduleStoppedWatches` leaves those stopped (moved, with the due-queue
      loop, to `src/lib/invoices/sweep-due.ts`).
- [x] Time budget: no new checks start after 15 s from the request
      (`SWEEP_BUDGET_MS`); the rest stay due for the next run. The summary
      reports `invalid` and `budgetReached`.
- [x] `fetchTipHeight` / `fetchTx` time out after 10 s like `fetchAddressTxs`.
- [x] Tests (TDD): wrong network and junk stop the watch without a lookup; the
      list check writes nothing; budget spent stops new checks; reschedule skips
      uncheckable addresses; timeouts present.
- [x] Manual (`manual-tests/v1.5.13-sweep-invalid-address.md`): TESTS 1–2 passed on SatSend-dev (2026-10-20); TEST 3 is watching production after merge.

---

### ✅ v1.5.1.4-H — Separate "Log in" and "Create account"

**Branch:** `v1.5.14/login-signup` · package `1.5.14` · migration `0033`.

**Request (Jonny, 2026-10-15).** Today `/login` is one form for everyone:
`signInWithOtp` creates an account for any unknown email. Someone who forgets
which address they used thinks they are signing in, gets "Confirm your SatSend
account", and lands in an empty new account with no invoices. Reference: a
login screen with "Welcome / Log in to …", one email field, **Continue**, and
"No account? Create one" underneath. Keep magic links for both; the user must
choose to switch between logging in and creating an account.

**Decided (Jonny, 2026-10-20).** Buttons "Send sign-in link" / "Create account".
Sign-up check limited to **5 an hour per IP** (planned as a firewall rule; done in
the app by v1.5.1.5-H, see below). Fold in two fixes to the same page: show
send errors instead of "Check your email", and explain expired/used links.

- [x] Two modes, each with its own address: `/login` ("Log in to SatSend",
      "No account? Create one") and `/signup` ("Create your SatSend account",
      "Already have an account? Log in"). The switch link carries the typed email
      across (`?email=`). Shared `src/components/auth/auth-form.tsx`.
- [x] **Log in with an unknown email:** `signInWithOtp` with
      `shouldCreateUser: false`; Supabase answers `otp_disabled` (422) with no
      account created and no email sent. Shows "There's no SatSend account for
      that email." with a **Create an account** button.
- [x] **Create account with a known email:** `POST /api/auth/signup-check` asks
      `public.is_email_registered` (migration 0033, security definer, EXECUTE for
      `service_role` only). If it exists, nothing is sent: "You already have an
      account with that email." with **Log in instead**.
- [x] Check-your-inbox screens say which email is coming.
- [x] Send errors are shown (e.g. "Please wait a minute before asking for
      another link"); `/login?error=auth` explains an expired or used link.
- [x] The logged-out redirect and sign-out still go to `/login` (the default).
      Homepage CTAs (v1.5.2-H) should link `/signup` and `/login`.
- [x] Tests (TDD): each mode sends the right call; unknown and known email show
      the prompt and send nothing; the switch keeps the email; 429 and failures
      explained; route validates input and fails loudly.
- [x] **At merge (2026-10-20):** 0033 applied to production, grants checked.
      The planned firewall rule was refused: Hobby allows one rate-limit rule,
      already used by `rate-limit-public-invoice-routes`. `/api/auth/signup-check`
      was added to that rule instead (30/min, outer layer) and the 5-an-hour limit
      moved to v1.5.1.5-H.
- [ ] Manual (`manual-tests/v1.5.14-login-signup.md`).

**Trade-off accepted:** both prompts reveal whether an email has an account
(account enumeration). The log-in side is limited by Supabase's own rate limits;
the sign-up check by v1.5.1.5-H.

**Later (not this branch):** collect more on sign-up (e.g. name) if wanted.

---

### ✅ v1.5.1.5-H — Sign-up check: 5 an hour per connection

**Branch:** `v1.5.15/signup-rate-limit` · package `1.5.15` · migration `0034`.

**Why.** v1.5.14's `POST /api/auth/signup-check` reveals whether an email has an
account, so it needs a tight limit (Jonny: 5 an hour per connection, allowing a
mistake or two). Vercel Hobby allows one firewall rate-limit rule, already used by
`rate-limit-public-invoice-routes` (30/min); the path was added there as an outer
layer (2026-10-20), and the 5-an-hour limit is counted in the app.

- [x] Migration 0034: `signup_check_attempts` (RLS on, no policies, no app-role
      grants) and `take_signup_check(key, limit, window)`: security definer,
      `service_role` only; one advisory-locked step that clears rows older than
      the window, counts the key's rows, and records the attempt only if under
      the limit (a refused attempt isn't recorded).
- [x] Route: key = HMAC-SHA256 of the client IP (`x-forwarded-for` first entry)
      with a server-only secret, never the raw IP; 5 per 3600 s; over the limit
      → 429 without looking the email up; limit check failing → 503 (fail
      closed). Invalid input is rejected before it counts.
- [x] Tests: limit asked before the lookup; 429 skips the lookup; same IP same
      key, different IP different key, key isn't the IP; fail closed. Database
      checked on SatSend-dev: 5 allowed then refused, another key unaffected,
      allowed again after the window, old rows cleared.
- [x] **At merge (2026-10-20):** 0034 applied to production. The MCP
      `apply_migration` call came back "cancelled" three times with no prompt
      (likely the connector's own confirmation for SQL containing `delete`), so
      Jonny ran the file in the SQL Editor and 0034 was recorded in
      `supabase_migrations.schema_migrations` by hand (`20261020230000`).
      Grants checked: anon/authenticated false, service_role true.
- [x] Manual (`manual-tests/v1.5.15-signup-rate-limit.md`): TESTS 1–3 pass.

---

---

## Pre-launch: marketing pages and hardening (archived 2026-10-27)

### ✅ v1.5.2-H — Redesign: marketing homepage

**Branch:** `v1.5.16/marketing` · package `1.5.16` · absorbs the old **v1.4.23
Marketing Landing Page** (superseded, archived 2026-10-10).

**Content signed off by Jonny (2026-10-21)** after a grill-me session, with four
reference sites (kvistly.com; jiro.build Payway, PayUp, JobHunt). Every word,
section and link is in `development/plans/v1.5.16-homepage-content-plan.md`;
change wording there first.

**Homepage**
- [x] `/` is the homepage for everyone (the redirect to `/dashboard` is gone).
      Signed-in visitors see "Go to app" in the menu instead of Log in / Get started.
- [x] Sections: hero ("Invoice in bitcoin. Paid straight to your wallet.", Get
      started plus How it works), trust strip, three steps, six highlights
      (including "Fully open source"), Free/Pro pricing cards (Pro $10, "Coming
      soon"), eight FAQ questions, closing call to action, footer (Product,
      Company, Developers, Legal; X and LinkedIn icons; no Log in; no wordmark).
- [x] The hero visual is the product (payment panel plus invoice row, moved from
      the style guide to `src/components/marketing/product-preview.tsx`). Its QR
      code encodes plain text, so scanning it can't send money.
- [x] Every link goes to a real page. Pages not built yet are "Coming soon"
      placeholders at their real addresses (`src/lib/site-links.ts`), each its own
      pre-launch item below. Kept out of search results meanwhile.
- [x] Metadata: title, description, OpenGraph and Twitter cards;
      `src/app/opengraph-image.tsx` (wordmark plus "Bitcoin invoicing");
      `metadataBase` from `getAppUrl()` so the image URL is absolute.
- [x] `README.md` description; copy audit (bitcoin only).
- [x] Desktop and 390px: no sideways scrolling; every tap target 44px or more.
- [x] **Deleted `src/app/styleguide/`** and `SHOW_UI_KIT`.

**Moved out:** the phone stacked invoice table is now its own item (v1.5.2.11-H).

**Tests**
- [x] `/` renders signed out and signed in ("Go to app", no redirect); every
      agreed section, plan card and FAQ question present; the example QR code
      isn't a `bitcoin:` request; metadata contains "SatSend"; every menu, footer
      and social link has a page (no dead links).

---

### ✅ v1.5.2.1-H — How it works page (`/how-it-works`)

**Branch:** `v1.5.18/how-it-works` · package `1.5.18`. Agreed with Jonny
(2026-10-21): real screenshots (not mock-ups), four steps, plus a "What your
client sees" panel.
- [x] Intro; four steps (create, send, your client pays, you're told), each
      with a real screenshot in `public/marketing/how-it-works/`.
- [x] "What your client sees" panel; "What you'll need" (a wallet, an email);
      closing band (now shared with the homepage).
- [x] Removed from `PLACEHOLDER_PAGES`, so it's indexed.
- [x] **Re-taking the screenshots:** `node test-automation/demo-screens.mjs`
      creates `maya@example.com` and four invoices on SatSend-dev (refuses any
      other project) and prints a one-time sign-in link. Before capturing the
      client's page and the editor, swap the testnet address and QR code for
      an unpayable example (see the v1.5.18 PR).

---

### ✅ v1.5.2.0.1-H — Draft or sent: no "Publish only"; dates are the sent date

**Branch:** `v1.5.19/draft-or-sent` · package `1.5.19` · migration `0035`.

> Found 2026-10-21 while taking the How it works screenshots: every "Date Sent"
> showed `created_at`, so a draft showed a sent date and an invoice drafted on
> Monday and sent on Friday said Monday (the client saw that too).
> **Jonny's decision:** remove "Publish only". An invoice is a draft or it's
> sent (email, PDF download, or copy the link and share it yourself), and every
> way to send gives it a sent date. First sent date stays.

**Why not `published_at`.** It's the payment checks' timer anchor and gets reset
(a detected payment that vanishes; restoring an archived invoice), so it's never
shown. `sent_at` is set once, at the moment the invoice goes live.

- [x] Send menu (was Publish): Send now via email · Download PDF and mark as sent ·
      Copy link and mark as sent ("Share the link yourself"). Same in the editor,
      the invoice page and the list's row menu. `publishInvoice` removed.
- [x] Copy link copies the client's link and shows a small "Link copied" notice
      that fades on its own (`showNotice`, `<NoticeHost />` in the app layout;
      copy starts inside the click so Safari allows it).
- [x] An email that doesn't go out leaves a draft a draft (no silent go-live);
      a draft with no client email can't be emailed. Messages shared by all three
      places (`src/lib/invoices/send-feedback.ts`); the editor opens the draft
      with the reason (`?email=`).
- [x] First sent date stays: a later email or a second "mark as sent" doesn't move it.
- [x] Dates: list "Date Sent" (sorts by it) and invoice page = `sent_at`; drafts
      show "Not sent" / no line. Client page and PDF say "Invoice date". PDF file
      name uses it too.
- [x] Migration 0035: invoices that went live without being sent get
      `sent_at = coalesce(published_at, created_at)`, `send_method = 'manual'`
      (test: 10 rows; production: 13 expected).
- [x] **At merge (2026-10-21):** 0035 applied to production via MCP (13 rows; no
      "cancelled"). Checked: 0 live invoices without a sent date, 0 drafts with one.
- [x] How it works "create" screenshot re-taken showing Send and "Required to
      send" (v1.5.20).
- [ ] Manual (`manual-tests/v1.5.19-draft-or-sent.md`).

---

### ✅ v1.5.2.2-H — Pricing page (`/pricing`)

**Branch:** `v1.5.21/pricing-page` · package `1.5.21`. Agreed with Jonny (2026-10-21).
- [x] Plan cards shared with the homepage (`src/components/marketing/pricing-plans.tsx`)
      with a **Monthly / Yearly (2 months free)** toggle: Pro $10/month, or
      $100/year shown as $8.33/month "Billed $100 yearly".
- [x] Comparison table of launch features only (reports and API are added when
      built). Pricing FAQ: pay in bitcoin or by card; card renews until turned
      off, bitcoin doesn't; you keep all your invoices when Pro runs out; refund
      within 15 days via support; Free is free forever.
- [x] Removed from the placeholder list (indexed).

---

### ✅ v1.5.2.3-H — FAQ page (`/faq`)

**Branch:** `v1.5.22/faq-page` · package `1.5.22`. Questions agreed with Jonny (2026-10-21).
- [x] 28 questions in five groups (Getting started, Getting paid, Invoices,
      Security and privacy, Pricing) with jump links; fold-out answers.
- [x] One source for every answer (`src/components/marketing/faq-content.tsx`):
      the homepage's eight and /pricing's five read from it.
- [x] "Can I delete my account?" answered (via support; v1.5.7-H builds it).
- [x] Not claimed: "open source", until v1.5.2.10-H decides the licence.

---

### ✅ v1.5.2.0.2-H — Link preview: ".me" sits below the SatSend baseline (fix)

> Found by Jonny, 2026-10-21, sharing satsend.me on WhatsApp: in the preview
> image the ".me" sits too low instead of on the same line as "SatSend".

**Cause.** `src/app/opengraph-image.tsx` lays out the wordmark as two text
spans in a flex row with `alignItems: "baseline"`. The image generator (Satori)
doesn't line up baselines of different font sizes the way a browser does, so the
smaller ".me" drops. The real logo (`SatSendLogo`, an SVG) puts both on one
baseline.

- [x] Fixed in v1.5.24 (`v1.5.24/og-logo`): the preview draws the site's own
      logo file (`public/brand/satsend-logo.svg`, already outlined as shapes),
      traced for the route; nothing left to mis-align.
- [ ] Test: WhatsApp after merge, sharing `https://satsend.me/?v=2` (it caches
      previews). Rendered locally: matches the site's logo.

---

### ✅ v1.5.2.4-H — Security page (`/security`)

**Branch:** `v1.5.25/security-page` · package `1.5.25`. Agreed with Jonny (2026-10-21).
- [x] Non-custodial explained plainly; what SatSend stores and what it can never
      do; access codes; the code is **source available and fully auditable**
      under FSL-1.1-ALv2 (never "open source"; reuse the FAQ's "Can I see
      SatSend's code?" wording) and how to audit it, linking fsl.software.
- [x] Never explains bitcoin networks (testnet is for development only).
      Access codes described broadly, no guess counts (limit: v1.5.2.12-H).
- [x] "Found a problem?": contact us, or a GitHub issue if it isn't urgent.
      Both GitHub links use `SOCIAL_LINKS.github` (`/coming-soon` until v1.5.2.9-H).

---

### ✅ v1.5.2.12-H — Limit wrong access-code guesses (**pre-launch**)

**Branch:** `v1.5.26/access-code-limit` · package `1.5.26` · migration `0036`.
Agreed with Jonny (2026-10-22): 5 wrong tries per 15 minutes, per connection,
per invoice; no cap per invoice across connections (it would let a stranger lock
the real client out).

> Found while writing the Security page (2026-10-21). Nothing limits wrong
> guesses at an invoice's access code, so someone with the link could keep
> trying until one works. Agreed with Jonny as its own small item; the
> Security page stays broad, so it needn't change.

- [x] Limit wrong guesses per invoice per connection, reusing the sign-up rate
      limit pattern (v1.5.15, migration 0034): `access_code_attempts` and
      `take_access_code_guess` (service_role only), connection = HMAC of the IP
      (`src/lib/client-key.ts`, now shared). Once the limit is reached every
      guess is refused, the right one included. "Too many wrong tries. Please
      wait 15 minutes and try again." Fails closed.
- [x] **Found while planning:** the access cookie held the code itself, and the
      PDF and payment-status routes accepted it, so codes could be guessed there,
      around the form. The cookie is now a server-made fingerprint (HMAC of
      invoice + code); a plain-code or made-up cookie opens nothing. Anyone who
      unlocked an invoice before v1.5.26 enters the code once more.
- [x] Tests: the limit trips, resets after the wait, and one invoice's
      guesses don't lock another (unit tests, plus `npm run test:rls` against
      the real test database).

---

### ✅ v1.5.2.10-H — Licence: source available under FSL-1.1-ALv2

**Branch:** `v1.5.23/fsl-licence` · package `1.5.23`.

> **Decided by Jonny, 2026-10-21:** the Functional Source License, Apache 2.0
> future licence (FSL-1.1-ALv2): the best balance between the cypherpunk ethos
> and not letting a cloner profit from the work. Anyone may read, audit, run and
> modify the code except to offer a competing product; each version becomes
> Apache-2.0 two years after release. Wording: "source available", "fully
> auditable"; never call SatSend "open source".

- [x] `LICENSE.md`: the official FSL-1.1-ALv2 text, `Copyright 2026 SATSEND LLC`.
- [x] `package.json` `"license": "FSL-1.1-ALv2"`; README Licence section.
- [x] Homepage highlight "Fully auditable"; FAQ "Can I see SatSend's code?"
      (links fsl.software); footer Developers: "Licence (FSL)".
- [x] Security page wording: done in v1.5.2.4-H (v1.5.25).

---

# Appendix A (archived 2026-10-27)

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
activity feed, v1.4.23 marketing landing page [launch-blocking; now v1.5.2-H], v1.4.24 row-action
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
   Notes, and the Pre-deployment Checklist. Target: comfortably under 2000 lines
   (the original "< 500" predated the hardening train). `next-feature` reads only
   `ROADMAP.md` (open items stay there).
2. **Fix stale markers** (M-PROC-3): flip v1.4.14.1/.2/.3 to ✅; tick the
   done-but-unchecked test boxes in merged sections.
3. **One tracker for outstanding verifications** (M-PROC-2): new
   `development/OUTSTANDING-VERIFICATIONS.md` listing the mainnet dry-run (launch
   blocker), v1.4.18 TESTS 3/6/7, and the Resend-webhook prod config, each with
   status and blocking-for. Add a `manual-tests/README.md` index.
4. **Banner PRD.md** (M-PROC-4) as historical/superseded; finish the rename
   (M-PROC-5) in PRD.md and the one live ROADMAP line. _(PRD part done
   2026-10-06: renamed, bannered, archived to `development/archive/PRD.md`.)_
   Still to do: extend `rename-to-satsend.test.ts` to cover `development/`.
5. **Add `.env.example`** at root (and `!.env.example` to `.gitignore`) with every
   var one-line-commented: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
   `EMAIL_FROM`, `CRON_SECRET`, `RESEND_WEBHOOK_SECRET`, `NEXT_PUBLIC_BTC_NETWORK`
   (flag this one — the mainnet detection failure was caused by it pointing at
   testnet), and the site-URL var.
6. **Fix version identity** (H-PROC-1): set `package.json` to the current version
   (`1.4.32` as of this revision — not the stale `1.4.18`), backfill a `v1.4.18`
   tag on merge commit `6af7c73`, and add "bump + tag on merge" to the git-workflow
   skill.
7. **Repo hygiene**: `.DS_Store` was already untracked (nothing to do); prune
   merged feature branches; note preserved-WIP branches in ROADMAP Notes. **Do NOT
   delete `master`** — it is an unrelated history (no merge-base with `main`, ~383
   commits that exist nowhere else). Optionally rename it `archive/pre-restart`.

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
4. **roadmap-size tripwire** — warn when `ROADMAP.md` exceeds ~160KB (not the
   original 40KB, which — like the "< 500 lines" target — predated the hardening
   train; the live file is ~152KB), so the archive discipline self-enforces.

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
