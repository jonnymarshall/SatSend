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

## Product

**SatSend** is Bitcoin-enabled invoicing for freelancers and small businesses.

- **Problem:** freelancers who want to accept Bitcoin have no simple way to make a proper fiat-denominated invoice, and crypto payment tools don't produce real invoices. The client shouldn't need deep crypto knowledge either.
- **Who it's for:** solo freelancers and small businesses.
- **The core loop:** create a fiat invoice, share a link and access code, the client pays via a BTC QR code, and the system detects the payment automatically through mempool.space and notifies both sides.
- **Monetisation:** a free tier and a paid tier (Pro). Invoicing is unlimited on both; Pro is feature-gated, not volume-gated. Full plan in the v2 section.
- **Principles / non-negotiables:**
  - Bitcoin-first. No fiat billing rails (the operator is a foreign LLC with no business bank account).
  - The platform never holds user funds. Invoice addresses are fresh and user-controlled, and the platform never takes a user xpub. Single exception: the platform billing xpub for premium payments.
  - The core loop (create, pay, get told) stays free forever.
  - Dark-first brand.

**This roadmap is the single source of truth** for what to build and why, per feature. `README.md` documents the payment-detection architecture. The original MVP PRD is archived at `development/archive/PRD.md`.

## Status Legend

| Emoji | Meaning |
|-------|---------|
| ✅ | Complete (merged) |
| 🔄 | In progress |
| ⏳ | Queued — not started |
| 🔴 | Queued — security/correctness blocker (do before feature work) |
| 🚫 | Deferred |

---

## Shipped so far

Completed work is archived verbatim in [`ROADMAP-ARCHIVE.md`](./ROADMAP-ARCHIVE.md)
(the whole v1.0 – v1.4.18 build, plus finished items moved 2026-10-11). Recent
shipments:

| Version | What | PR | Date |
|---|---|---|---|
| v1.5.2 (v1.5-H) | Signal Amber redesign, in-app screens | #70 | 2026-10-10 |
| v1.5.1 | Clear error for a BTC address on the wrong network | #71 | 2026-10-10 |
| v1.5.0 (v1.5.0-H) | Internal UI kit (`/styleguide`) | #69 | 2026-10-10 |
| v1.4.36 | Test automation harness | #64 | 2026-10-08 |
| v1.4.31.2-H | Integration harness: DB-invariants suite | #61 | 2026-10-07 |
| v1.4.31.1-H | Integration harness: first suite (real RLS) + anon-EXECUTE fix | #60 | 2026-10-07 |
| v1.4.31-H | Address uniqueness across tenants (H-DB-3) | #59 | 2026-10-07 |
| v1.4.30-H | Realtime unification | #58 | 2026-10-07 |
| v1.4.29-H | Zod + typed action results | #57 | 2026-10-07 |
| v1.4.27-H | Generated Supabase types | #56 | 2026-10-06 |
| v1.4.26-H | Abuse controls (code side) | #55 | 2026-10-06 |
| v1.4.25-H | Public-endpoint hardening | #54 | 2026-10-06 |
| v1.4.24-H | Proxy & boundaries | #53 | 2026-10-06 |
| v1.4.23-H | RLS & indexes | #52 | 2026-10-06 |
| v1.4.22-H | Detection robustness (server) + ws-reconnect (client) | #49 / #50 | 2026-10-06 |
| v1.4.19-H … v1.4.21-H | Hardening Phase 0 (launch blockers) | archived | 2026-10-05 |
| v1.0 – v1.4.18 | Core product build | archived | 2026-05 – 2026-07 |

## Developer Enablement (do first — unblocks testing and speeds everything up)

> **Current priority.** This lets the agent write and test features end to end
> (create an invoice, pay it, wait for detection and confirmations, assert the
> result) without the human doing manual testing. Dev-only tooling, never shipped
> to production. Run it before and alongside the hardening train.

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
> **v1.4.28-H (S3)**. Do NOT do those two separately. Their old sections are in
> `ROADMAP-ARCHIVE.md` (moved 2026-10-11), kept for their detailed spec only.

### Phase 0 — Launch blockers (do in this order)

✅ **All done** (S0 – S4: v1.4.19-H, v1.4.20-H, v1.4.19.1/.2/.3-H, v1.4.28-H,
v1.4.21-H, including the 2026-10-06 mainnet smoke test). Their sections are in
[`ROADMAP-ARCHIVE.md`](./ROADMAP-ARCHIVE.md) under "Archived 2026-10-11".

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
- ✅ **v1.4.23.1-H — Invoice-number uniqueness** (`v1.4.23.1-H/invoice-number-uniqueness`):
  shipped (package `1.4.37`) — production's 8 duplicate groups (16 rows) resolved by
  renaming the later copies to `<number> (dup N)` (**not** deleting: the v1.4.21-H
  trigger blocks deleting non-draft invoices, and 6 of the 8 groups involve one),
  then the unique index `invoices_user_id_invoice_number_idx` on
  `(user_id, invoice_number) where invoice_number is not null and invoice_number <> ''`.
  **Deviation from spec:** a partial index on non-blank numbers instead of a
  separate `check (invoice_number <> '')` — the app writes NULL (never '') for blank
  drafts, so the index already covers it and a blanket CHECK is unnecessary. Applied
  to test and production. **Split out:** the friendly `23505` message → v1.4.23.2-H.
- ✅ **v1.4.23.2-H — Friendly duplicate-invoice-number message** (2026-10-08):
  **already satisfied, no work needed** — `dbErrorToFieldError` (v1.4.29-H) already
  maps a `23505` on the invoice-number index to `invoice_number` with "You already
  have an invoice with this number." My earlier split was redundant; closed.
- ✅ **v1.4.24-H — Proxy & boundaries** (`v1.4.24-H/proxy-and-boundaries`): shipped —
  the proxy now exports `config` (Next reads it, so the matcher finally applies and
  the proxy stops running on static assets) and validates the token with `getUser`
  instead of trusting the cookie; added root `error.tsx` + `not-found.tsx` and
  dashboard/invoice `loading.tsx`; added security headers in `next.config.ts`
  (`X-Frame-Options: DENY`, nosniff, referrer, HSTS, and a minimal CSP of
  frame-ancestors/object-src/base-uri only). The stricter nonce-based CSP is
  deferred: it forces dynamic rendering, and a wrong `connect-src` would silently
  kill the live mempool/Supabase sockets.
- ✅ **v1.4.25-H — Public-endpoint hardening** (`v1.4.25-H/public-endpoint-hardening`):
  shipped — the public PDF route now enforces the access code (404 on failure);
  the access cookie's path widened to `/` (which also fixed the payer fast-path
  silently 404ing on access-protected invoices) and gained `secure` in prod;
  `btc-price` rejects non-USD with 400; the cron secret is compared in constant
  time; line items capped at 100; the public PDF is cached by version (ETag/304).
- ✅ **v1.4.26-H — Abuse controls (code side)** (`v1.4.26-H/rate-limiting`): shipped —
  server-side `client_email` validation (empty OK, malformed rejected on save and
  at send, where a bad payer address skips quietly); minimum access-code length of
  6; and a per-user daily send cap of 200 enforced in the shared send helper. At
  the cap, automated sends (detected/confirmed) are skipped without throwing so the
  sweep/fast-path cannot crash, while owner-initiated sends surface an error.
  **Split out:** rate limiting → v1.4.26.1-H (hashed access codes were considered
  and scrapped — see below).
- ✅ **v1.4.26.1-H — Rate limiting (done); hashed access codes scrapped** (2026-10-08):
  **Rate limiting: done** — a Vercel Firewall rule (Hobby, free — one rule allowed;
  30 req / 60 s per IP, 429) on `/invoice/`, `/api/invoice/`, `/api/invoices/`,
  covering the access-code verify, PDF and payment-polling surfaces. It lives in
  Vercel, not the repo (see `manual-tests/v1.4.26.1-H-rate-limiting.md` and the
  `deploy-checklist`); online guessing is now pointless.
  **Hashed access codes: scrapped, not built.** Considered (HMAC/keyed hash), but the
  UX and dev cost outweighed the small gain — owners could no longer see or resend
  their code, and the published email prints it — especially with guessing now
  rate-limited. Codes stay plaintext in `invoices.access_code`. The v2.3 client-page
  code cascade is unaffected either way (it never reads invoice codes).

### Phase 2 — Structural single-sources-of-truth

Each is one branch. Detail: Appendix A → Phase 2.

- ✅ **v1.4.27-H — Generate Supabase types** (`chore/supabase-types`): shipped —
  `src/lib/database.types.ts` generated (`npm run gen:types`) and committed;
  `Database` threaded through the three client factories; the hand-declared row
  shapes replaced by types derived from the generated ones (one `Invoice` + `Pick`
  subsets); one home for the JSONB cast. `npm run typecheck` added as the gate.
  Surfaced real drift (nullable `btc_address`, `send_method` as text, untyped
  update payloads).
- ✅ **v1.4.29-H — Zod + typed action results** (`refactor/zod-validation`): shipped —
  one shared `invoiceSchema`; server actions now RETURN `{ ok, field, message }` for
  field-validation failures (thrown messages are masked in production), including
  translated DB constraint violations (the address unique index → a btc_address
  field error). Structural errors still throw; `parseServerError` deleted.
  **Split out:** the form's three parallel arrays → v1.4.29.1-H.
- ✅ **v1.4.29.1-H — Collapse the form's parallel arrays** (`v1.4.29.1-H/form-line-item-state`):
  shipped (package `1.4.35`) — the form's three index-synced arrays (`line_items`,
  `rawAmounts`, `itemKeys`) are now one `LineItemState[]`; the numeric `LineItem[]`
  is derived via `toLineItems`. Behaviour-preserving (DOM ids and the existing
  validation unchanged), so the refactor is provably safe. **Split out:** the second
  clause (import the shared `invoiceSchema` client-side) → v1.4.29.2-H, since it
  changes validation semantics and messages.
- ✅ **v1.4.29.2-H — Schema-backed client-side form validation** (`v1.4.29.2-H/form-schema-validation`):
  shipped (package `1.4.38`) — the form's `validate()` now runs the shared
  `invoiceSchema` over the payload (one source of truth with the server actions) and
  maps Zod issues to field errors, keeping the publish-time "BTC address required"
  rule and the form-only address FORMAT check; error display added for tax percent
  and access code. Deferred from v1.4.29.1-H.
- ✅ **v1.4.30-H — Realtime unification** (`refactor/realtime-and-styling`): shipped —
  one `useInvoiceChannel` hook (auth + subscription style as explicit parameters)
  with bounded resubscribe (6 attempts, 1s→30s), replacing two near-duplicate
  hooks; the three existing exports are thin wrappers, so no call sites moved.
  `confirmationDepth` now cross-references `CONFIRMATION_DEPTH_REQUIRED` (the
  reorg rationale already existed). **Split out:** the colour source of truth →
  v1.4.30.1-H.
- ✅ **v1.4.30.1-H — One colour source of truth** (`v1.4.30.1-H/colour-source`):
  shipped (package `1.4.36`) — **`globals.css` is canonical** (it is what the app
  renders; no visual change before the v1.5 redesign). `brand-colors.ts` synced to
  the browser-accurate hex of the `.dark` tokens (`background #010101`,
  `surface #070707`, `primary #D02A3A`, `muted #727460`), and `brand-colors.test.ts`
  now fails if any of the four drifts (OKLCH→hex, ±2/channel). `foreground`/`paper`
  are PDF-only and unguarded. Visual restyle stays with v1.5.
- ✅ **v1.4.31-H — Address uniqueness across tenants (H-DB-3)** (`v1.4.31-H/address-uniqueness`):
  shipped — a `security definer` RPC (`is_address_registered`, search_path pinned,
  execute limited to authenticated) lets the pre-check see across tenants, so a
  cross-tenant collision is caught at validation time instead of after a failed
  insert. Layered: own-row lookup (names your invoice) → RPC (generic) → 23505
  (race). **Honest scope:** this does NOT close the address-registered oracle
  (intrinsic to global uniqueness; rate limiting is the mitigation, v1.4.26.1-H) —
  it makes the pre-check correct and the error timely. **Split out:** the
  integration test harness → v1.4.31.1-H.
- ✅ **v1.4.31.1-H — Integration test layer (first suite)** (`v1.4.31.1-H/supabase-integration`):
  shipped `test-automation/rls-integration.mjs` (`npm run test:rls`) — local-only,
  runs against the real test Supabase with real user JWTs, and is guarded (skips
  without an anon key; aborts on a production URL or `PAYMENT_SWEEP_ENABLED`).
  Proves what mocks cannot: anon EXECUTE is denied, the RPC returns a bare
  boolean, the cross-tenant backstop fires, and RLS hides one tenant's invoice
  from another. **It found a real bug**: Supabase's default privileges re-grant
  EXECUTE to `anon` on new functions, so 0030's `revoke … from public` had not
  taken — fixed by 0031 (test and prod). Follow-ups: CI wiring, more suites
  (status transitions), M-FE-1's shared fake.
- ✅ **v1.4.31.2-H — Integration harness, second suite: DB invariants** (`v1.4.31.2-H/db-invariants`):
  `test-automation/db-invariants.mjs` (`npm run test:db`) proves migration 0027
  against real Postgres: impossible money (inconsistent totals, negative, non-USD,
  out-of-range tax, malformed line items) is rejected; non-draft invoices cannot be
  deleted; a paid invoice's money is frozen while its status stays writable; a
  draft can be deleted. Same DB-only blind-spot class as the anon hole.

### Roadmap & docs housekeeping (do alongside Phase 0)

- ✅ **v1.4.32-H — Roadmap/docs restructure** (`chore/roadmap-restructure`): shipped
  — ✅ history (v1.0–v1.4.18) moved verbatim to `ROADMAP-ARCHIVE.md`; live file is
  ~2225 lines (the old "< 500" target predated the hardening train — restated
  honestly); `development/OUTSTANDING-VERIFICATIONS.md` + `manual-tests/README.md`
  added; `.env.example` added; `package.json` set to `1.4.32` (plain SemVer, not
  the stale `1.4.18`); rename guard extended to `development/` (archive excluded).
  **Git-only, separate session (step 7):** backfill the `v1.4.18` tag, bump+tag this
  merge `v1.4.32`, prune merged branches. **`master` is NOT deleted** — unrelated
  history (~383 commits, no merge-base with `main`); optionally renamed
  `archive/pre-restart`. Detail: Appendix A → "Roadmap & docs restructure".
- ✅ **v1.4.33-H — Claude workflow hooks/skills** (`chore/claude-hooks`): shipped —
  CI workflow (`.github/workflows/ci.yml`: typecheck + unit tests + lint on PR; the
  real, tool-blind gate — unit-only, since the integration suites are local-only);
  four warn-only hook scripts in `.claude/hooks/` wired via `settings.json` (commit
  gate, typecheck-on-Stop, version-sync, roadmap-size); three skills, mirrored in
  both `.claude/skills/` and `.agents/skills/` (pre-merge-verification,
  migration-safety, deploy-checklist); `write-a-prd` now invokes `grill-me`; a
  project brief added to `AGENTS.md`; `git-workflow` amended to "bump on branch, tag
  on merge". Preserved branches recorded in Notes.

### Phase 3 — Redesign, then the feature queue resumes

Once Phase 0 and Phase 1 are green (the tech works), do **v1.5 (Full Site
Redesign)** first — the design direction is locked and the brand handoff is in the
repo, so it should not wait behind the entire feature queue. Then resume the ⏳
feature items below in order (v1.4.20 auto-overdue emails onward). They are
unchanged by the audit. Note again that the old v1.4.19 and v1.4.28 sections are
**superseded** by v1.4.19-H and v1.4.28-H above — keep them for reference but do
not re-implement.

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

### ⏳ v1.5.0.1-H — Realtime: crash when a live-update channel is re-opened

**Branch:** `fix/realtime-channel-reuse` · package: next patch at merge (`1.5.3` if
after v1.5-H) · **Not urgent** (Jonny, 2026-10-11): logged for a future branch.
Dev shows an error overlay that can be dismissed; production only loses live
updates after a dropped connection. Independent of the redesign (realtime code is untouched on
`v1.5/redesign`); found while testing it, 2026-10-11.

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
- [ ] In `connect()`, before `supabase.channel(name)`, find any registered channel
      with topic `realtime:${name}` (`supabase.getChannels()`) and
      `await supabase.removeChannel(...)` it.
- [ ] In `scheduleReconnect()`, `await` the removal before calling `connect()`.
- [ ] Wrap `connect()`'s body in try/catch: log and `scheduleReconnect()` instead of
      leaving an unhandled rejection.
- [ ] Tests (fake Supabase client): a stale same-topic channel is removed before
      the new one is set up; a Strict-Mode style mount → unmount → mount does not
      throw; the reconnect path awaits removal; an error in `connect()` schedules a
      retry.
- [ ] Manual: open an invoice detail page in dev (no error overlay); publish or
      mark paid in another tab and see the detail page update by itself.

**Not in scope:** two components subscribing to the same topic at once would still
share one channel. Nothing does that today.

---

### ✅ v1.5.0.2-H — Emails land in spam (code side)

**Branch:** `fix/email-delivery` · package `1.5.3` · reported 2026-10-11.

**Report.** An invoice emailed to Jonny's personal address "never arrived". It had
gone to **spam**. The dev log shows Resend accepted every send, so sending works;
the problem is how inboxes judge the email.

**Found (2026-10-11).**
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

**Branch:** `fix/app-url` · package `1.5.4` · found 2026-10-11 while checking
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

### ⏳ v1.5.0.4-H — DMARC: tighten `p=none` → `p=quarantine` (**not before 2026-11-08**)

**Branch:** none needed (a DNS change in Namecheap, done by Jonny) · **Date-gated.**

> **If this item comes up before 2026-11-08: do not do it.** Move this whole
> section further down the queue (below the next item), keep the date, and carry
> on with the next item. Only do it on or after the date, and only if the checks
> below pass.

**Why.** `p=none` (set 2026-10-11) asks inboxes to check SPF/DKIM and *report*
only; it changes nothing about delivery, but publishing a DMARC record at all
fixes the "DMARC: FAIL" seen in Gmail's "Show original" and is what Gmail and
Yahoo expect. `p=quarantine` goes further: it tells inboxes to send any email
that claims to be from `satsend.me` but fails the checks to spam. That protects
SatSend's name from being forged in phishing emails (an invoice product is an
obvious target) and is a stronger trust signal. Switching too early is the risk:
if any legitimate email fails the checks, quarantine sends *your own* invoices to
spam. Four weeks of passing results is the safety margin.

**Checks before switching.**
- [ ] The `p=none` record is live (`dig +short TXT _dmarc.satsend.me` returns
      `v=DMARC1; p=none`), and has been for at least four weeks.
- [ ] Gmail "Show original" on a recent invoice email from **production** shows
      SPF PASS, DKIM PASS, DMARC PASS. Same for one sent from local dev.
- [ ] Resend dashboard: no unexplained failed or bounced sends.
- [ ] No other service sends email as `@satsend.me` without being set up for it
      (it would start landing in spam).

**Then.**
- [ ] In Namecheap, change the `_dmarc` TXT value to `v=DMARC1; p=quarantine;`
- [ ] Re-check "Show original" on the next invoice email: DMARC PASS, and it lands
      in the inbox.
- [ ] Later and optional: `p=reject` once quarantine has run cleanly for a while.

---

### ⏳ v1.5.1-H — Redesign: emails + PDF

**Branch:** `v1.5.1/emails-pdf`

- [ ] Restyle the email templates (`src/lib/email/templates/*`) in Signal Amber;
      the publish email's button is still red `#DE3C4B`.
- [ ] **Redesign the invoice PDF**, not just its colours. Jonny's feedback
      (2026-10-11): "I really don't like how the PDF is looking." Treat it as a
      full layout redesign in Signal Amber (logo, hierarchy, spacing, totals,
      payment details, status), matching the public payer page. Colours already
      follow `brand-colors.ts`.
- [ ] Apply the semantic status colours in emails and PDF.
- [ ] Logo files: export font-independent, outlined-path versions of the wordmark
      (default, reversed, monochrome) with the decided `.me` spacing (dx=1.5),
      from the Onest outlines (extend `scripts/brand/outline-mark.py`). Emails
      need a PNG of it (most email apps do not show SVG). The handoff folder stays
      untouched; the new files live in the app.

---

### ⏳ v1.5.2-H — Redesign: marketing homepage + logo links home

**Branch:** `v1.5.2/marketing` · absorbs the old **v1.4.23 Marketing Landing Page**
(superseded, archived 2026-10-11).

> **Jonny's brief (2026-10-11):** "I really like how that was mocked up in the
> styleguide. So I want you to just go ahead and give it your best shot." Build
> from the kit's marketing composition (nav, hero, footer in
> `src/app/styleguide/_kit`) without stopping for design approval; show him the
> result in the PR.

**Homepage**
- [ ] Build the homepage at `/` (today `/` redirects to `/dashboard`). Start from
      the styleguide's marketing nav, hero and footer; use the product UI itself
      as the core visual (DESIGN.md §10), not stock imagery. Bitcoin explicitness
      2–2.5/5; copy plain and specific (DESIGN.md §15).
- [ ] Sections: hero (one-line value prop + "Create invoice" CTA), 3–5 product
      highlights (bitcoin invoice in seconds; live BTC/fiat at view time; on-chain
      payment detection; no fiat rails; you keep your own keys), a 1-2-3 "How it
      works", and a closing sign-in CTA. No newsletter, analytics or form embeds.
- [ ] **`/` shows the homepage to everyone** (changed from v1.4.23, which
      redirected signed-in users to `/invoices`; that would make the logo link
      below pointless). Signed-in visitors see "Go to app" in the nav instead of
      "Sign in".
- [ ] Metadata: `title`, `description`, `openGraph` (title, description, image).
      An OpenGraph image route with the wordmark and "Bitcoin invoicing" tagline.
- [ ] `README.md` top-of-file description matches the positioning.
- [ ] Copy audit for anything contradicting bitcoin-only positioning.
- [ ] Desktop + 390px, 44px targets, contrast pass (same checks as v1.5-H).

**Logo always links home** (Jonny, 2026-10-11)
- [ ] The SatSend logo is **always a link to `/`**: the signed-in app header
      (today it goes to `/invoices`, which duplicates the "← Invoices" back
      button), the public payer page and the access-code screen (not clickable
      today), and the login page.

**Also**
- [ ] Optional follow-up from v1.5-H: on phones, show the invoice table as stacked
      rows instead of sideways scrolling (a layout change, so it needs a decision).
- [ ] **Delete `src/app/styleguide/`** (the internal kit) as the last step, after
      the homepage is built from it, and tick it off in `OUTSTANDING-VERIFICATIONS.md`.

**Tests**
- [ ] `/` renders without auth (hero copy present) and with auth (nav shows
      "Go to app"; no redirect).
- [ ] Every logo instance is a link to `/` (header, payer page, access gate, login).
- [ ] Metadata snapshot: `title` and `openGraph.title` contain "SatSend".

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

- **Preserved branches (v1.4.32-H cleanup, 2026-10-07).** Four branches are kept on
  purpose and must NOT be deleted: `master` (an unrelated history, ~383 commits, no
  merge-base with `main`), `v1.0/foundation` (its own initial commit),
  `v1.4.14/fiat-payment-and-manual-confirmation` (local + `origin`; abandoned fiat
  work, marked as such). Merged feature branches were pruned; tags `v1.4.18` and
  `v1.4.32` added.
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
- [ ] **Verify a sending domain in the Resend dashboard** and set `EMAIL_FROM` to an address on that domain. Without a verified domain, Resend only delivers to the email address on the Resend account itself — sends to any other recipient (clients, test addresses) return a 422 and the email never arrives. This is a Resend free-tier safety rail, not a SatSend bug.
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

- **H-FE-1 — Test suite is RED on main. [RESOLVED]** Fixed by the v1.4.19-H (S0)
  time-freeze; re-verified at v1.4.31-H: `npm run test:run` is 578/578 green on
  main. Kept for the record.

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

- **M-PROC-4 — PRD.md was dead documentation.** Renamed to SatSend, bannered as
  historical, and moved to `development/archive/PRD.md` (2026-10-06). It still
  describes superseded behaviour (auto-generated codes, `tax_fiat`, the login
  sweep); the banner covers that. `development/ROADMAP.md` is the source of truth.

- **M-PROC-5 — Rename to SatSend is incomplete.** The PRD (now
  `development/archive/PRD.md`) and the one live ROADMAP line are fixed
  (2026-10-06); the **Supabase project name** still uses the pre-rename name
  (dashboard rename outstanding). The rename guard now covers living docs under
  `development/` (archived history and `ROADMAP-ARCHIVE.md` are excluded).

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
