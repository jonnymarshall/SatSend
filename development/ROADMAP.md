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
  - Bitcoin-first for invoices. Pro can be paid in bitcoin or by card (card added 2026-10-21, v1.5.4-H; it was bitcoin-only because the operator is a foreign LLC with no business bank account).
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
(the whole v1.0 – v1.4.18 build, plus finished items moved 2026-10-10). Recent
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
> `ROADMAP-ARCHIVE.md` (moved 2026-10-10), kept for their detailed spec only.

### Phase 0 — Launch blockers (do in this order)

✅ **All done** (S0 – S4: v1.4.19-H, v1.4.20-H, v1.4.19.1/.2/.3-H, v1.4.28-H,
v1.4.21-H, including the 2026-10-06 mainnet smoke test). Their sections are in
[`ROADMAP-ARCHIVE.md`](./ROADMAP-ARCHIVE.md) under "Archived 2026-10-10".

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

### ⏳ v1.4.34 — Legal & Compliance Bundle (pre-launch, non-urgent)

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

**Status (2026-10-27, legal and compliance train):**
- Item 1 (age gate) **moved to v1.5.2.15-H**, combined with agreeing to the
  Terms at sign-up.
- Item 2 (fonts) is **probably already met**: `next/font/google` downloads the
  fonts at build time and serves them from satsend.me. Confirm with a network
  check (no request to fonts.googleapis.com or fonts.gstatic.com), then tick.
- Item 3 (session replay): **no analytics or replay tools are loaded**, so close
  as not applicable once confirmed in the browser.
- Item 4: also needs **opt-in consent** for marketing emails (UK/EU rules),
  recorded with a date, not just an unsubscribe link.
- Item 5 is covered by v1.5.4-H (card payments).

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

> Finished v1.5.0.1-H – v1.5.1.5-H sections were moved to
> [`ROADMAP-ARCHIVE.md`](./ROADMAP-ARCHIVE.md) on 2026-10-21.
> Finished v1.5.2-H – v1.5.2.12-H sections (marketing pages, licence, access-code
> limit) were moved there on 2026-10-27.

## Pre-launch: marketing site pages and accounts

> **Jonny (2026-10-21):** "I don't want to launch with any placeholder links or
> pages." Each page below exists today as a "Coming soon" placeholder (v1.5.16).
> **Every item in this section must be done before launch.** Build each from the
> placeholder at the same address: replace `<ComingSoon path=… />` in its
> `page.tsx`, drop `robots: noindex`, and remove it from `PLACEHOLDER_PAGES` in
> `src/lib/site-links.ts`.

### ✅ v1.5.2.13-H — Paid invoice: hide the payment QR once a txid exists (**pre-launch**)

**Branch:** `v1.5.27/hide-qr-after-txid` · package `1.5.27` · no migration.

> **Jonny, 2026-10-26:** paid an invoice, left the tab open, and when he came
> back the QR code had changed. Confirmed in the code, and it still happens after
> payment.
>
> **Cause.** Returning to the tab fires `router.refresh()` on every visibility
> change (`src/lib/realtime/use-invoice-channel.ts:62`, not gated on payment
> state). The public page re-fetches the live BTC price on each render
> (`src/app/invoice/[id]/page.tsx:26-33`; `src/lib/btc-price.ts` caches it for
> 60s), the view recomputes `btcAmount` and `bip21Uri` from `total_fiat` and the
> new price (`invoice-payment-view.tsx:62-73`), and `BtcQrCode` re-encodes
> whenever the URI changes (`src/components/btc-qr-code.tsx:14-28`). A paid
> invoice auto-reveals the BTC block (`invoice-payment-view.tsx:60`), so it keeps
> showing a fresh, payable-looking amount and QR for an invoice that is already
> paid.

**Decision:** once a transaction exists, this invoice cannot be paid again, so
show no payable QR and no live-recomputed BTC amount. Gate on **`btcTxid`**
(persisted `btc_txid`), which covers both `payment_detected` and `paid`; do not
gate on the status string alone.

- [x] In `invoice-payment-view.tsx`, when `btcTxid` is set: drop the
      `BtcQrCode`, the "BTC amount"/"at $X/BTC" block, and the copy that implies
      the client still owes. Keep the address (for reference), the transaction ID
      link, and the amount-received figures when recorded.
- [x] Treat it as a permanent state, not a transient one: the same rule must hold
      for a txid that arrives mid-session by watcher or realtime UPDATE, and for
      a paid invoice reopened later from a fresh page load.
- [x] Do **not** change the visibility-driven `router.refresh()` (it carries
      status updates) or the amount shown on the dashboard/PDF. Display-only.
- [x] Tests in `invoice-payment-view.test.tsx`: no txid → QR and amount shown;
      `payment_detected` with a txid → no QR; `paid` → no QR; a txid arriving via
      the realtime callback hides it in the same session.
- [x] Manual: pay a testnet invoice, leave the tab, return after a price move:
      the QR must not appear or change.

- [x] Shipped as a "Payment detected" / "Paid" / "Underpaid" card: the address
      for reference, the transaction link, and what arrived when recorded.
      Wording says the bitcoin "was received to the bitcoin address for this
      invoice", never "we received" (SatSend holds nothing). Underpaid, Jonny's
      wording (2026-10-27): "… less than the amount requested. To resolve full
      settlement of this invoice, reach out to [Sender]." Also fixed: a paid
      invoice viewed while the price service is down no longer says "please
      calculate the amount manually".
- [x] Follow-up in the same release (Jonny, 2026-10-27): the block reads at a glance. An
      icon and colour per state (detected violet clock, paid green tick,
      underpaid amber warning, overpaid blue plus), Requested / Received /
      Difference for under- and overpaid, "Overpaid" as its own state and badge
      ("To discuss the extra $X, reach out to [Sender]"), and the date and time
      ("Paid on", from the block's time in new column `payment_confirmed_at`,
      migration 0037; else "Seen at"). Design chosen from four proposals on a
      canvas: receipt layout. After manual testing (Jonny, 2026-10-27): the
      sums box on every paid state, "Outstanding" instead of "Difference"
      ($0.00 paid, positive underpaid, negative overpaid); transaction ID in
      full except on phones; the open page rechecks on each new block while a
      payment is detected (it used to stay "Payment detected" until reloaded);
      "Mark as unpaid" removed for blockchain-confirmed payments (it flipped
      straight back and resent the email).
- [x] A paid invoice whose amount differs within the allowance shows an
      "Exchange rate difference" row (+ over, − under) between Received and
      Outstanding, so the sums add up on screen (Jonny, 2026-10-27). The PDF no
      longer prints a payable QR for underpaid, archived-paid or txid invoices.

**Done when:** a paid/detected invoice never renders a payment QR or a live BTC
amount, however and whenever its page is loaded.

---

### ⏳ v1.5.2.21-H — The payment block in emails and PDFs (**pre-launch**)

**Branch:** `v1.5.28/payment-block-emails-pdf` · package `1.5.28` · no migration
expected.

**Context (Jonny, 2026-10-27).** v1.5.27 redesigned the payment block on the
client's invoice page. The payment emails and the PDF should match it as
closely as possible, in information and styling, as the links work did.
Today the four payment emails (detected and confirmed, to the sender and to
the client) have a status pill only, no amounts box, no time, no Overpaid
state, and the client's underpaid email says "We received", which breaks the
wording rule (never imply SatSend holds funds). The PDF has a plain "Paid in
bitcoin" panel.

**Scope (decisions agreed 2026-10-27):**
- [ ] Every payment email gets the block: coloured circle icon and state name
      (Payment detected violet clock, Paid green tick, Underpaid amber warning,
      Overpaid blue plus), the Requested / Received / [Exchange rate
      difference] / Outstanding box, the next-step sentence, "Paid on" or
      "Seen at", the full address and the full transaction ID.
- [ ] Icons in emails are small PNGs attached inline, like the logo (email
      apps strip SVG).
- [ ] Client emails: "To resolve full settlement of this invoice, reach out to
      [Sender]." / "To resolve overpayment of this invoice, reach out to
      [Sender]." Sender's own emails name the client instead.
- [ ] Remove every "we received" (and similar) from the payment emails.
- [ ] Email times in UTC, named ("2:54 AM UTC"): the reader's zone is unknown.
- [ ] Subjects: "Underpaid" replaces "Partial payment"; new Overpaid subjects
      ("Overpayment received for invoice X").
- [ ] The PDF's paid panel becomes the same block, drawn natively (react-pdf
      `Svg` for the icons); its times use the downloader's time zone, passed
      from the browser.
- [ ] Manual tests with real sends (Resend) of each state.

---

### ⏳ v1.5.2.22-H — Locked quotes and a tighter payment allowance (**pre-launch**)

**Context (Jonny, 2026-10-27).** A payment counts as paid in full within 5%
either way: $400 on an $8,000 invoice, which is too generous. The allowance is
wide because of how payments are valued, not client error: the client pays
the bitcoin amount shown when they opened the QR, but SatSend values it at the
exchange rate when it **confirms**, often 10 to 60 minutes later, and the
price can move 1 to 3% in that time. Tightening the allowance alone would mark
honest clients underpaid on volatile days. Agreed plan:

**Scope:**
- [ ] **Lock the quote.** When the client reveals the QR, record the quoted
      bitcoin amount, price and time (new table, server-written). A quote is
      valid for about 30 minutes; the page refreshes it after that.
- [ ] **Judge in bitcoin.** A payment that matches a valid quote is compared in
      bitcoin against that quote, so price movement drops out. Value it at the
      quoted price, so an exact payment shows Received equal to Requested and
      no "Exchange rate difference" row.
- [ ] **Fallback.** With no valid quote (paid late, or from the PDF, whose QR
      has no amount), value at the price when the payment was **first seen**,
      not when it confirmed.
- [ ] **Tighten the allowance**, for example 1% capped at $25 to $50 (decide
      the numbers when built). Update the FAQ's "within 5%" answer.
- [ ] Revisit the "Exchange rate difference" label: with quotes locked, the
      small gaps left are mostly wallet fees, not the exchange rate.

---

## Legal and compliance train (**pre-launch**, next after v1.5.2.13-H, v1.5.2.21-H and v1.5.2.22-H)

> **Jonny, 2026-10-27:** "I want to make sure I am maximally covered for legal
> compliance", with a dedicated Terms page and a Legal page, advanced to the
> soonest reasonable opportunity. Sources: a conversation with Gemini about
> non-custodial bitcoin invoicing, two short videos on launch security and
> compliance, and what Claude knows of the codebase. Claude drafts; **none of it
> is legal advice**, and a qualified lawyer reviews Terms and Privacy before Pro
> takes money (in v1.5.2.8-H).
>
> Already covered elsewhere, so not repeated here: row level security on every
> table (v1.4.29-H; Supabase's advisor shows none missing), sessions in cookies
> not localStorage (`@supabase/ssr`), no admin role anywhere in the client, no
> passwords (email links only), rate limits on sign-up checks and access codes
> (v1.5.15, v1.5.26). Already queued in v1.4.34: marketing-email unsubscribe
> and postal address, renewal terms, DMCA agent. Not applicable: SMS consent
> (SatSend sends no texts), password rules (no passwords).

**Compliance guardrails (never build without legal review first).** SatSend
stays a software provider, not a money transmitter, as long as it never touches
users' money. So, without a lawyer's sign-off, never build: holding or passing
on funds (even briefly), balances or wallets on SatSend, escrow, taking a fee
or percentage out of a payment, swapping currencies for users, or custodial
Lightning (any future Lightning support pays to the user's own node or
provider). Pro is a flat subscription paid to SatSend, kept apart from users'
payments; that is safe.

### ⏳ v1.5.2.8-H — Terms of service (`/terms`) (**pre-launch**, moved up)

> Was a one-line placeholder. **Must be live before Pro**, ideally before launch.

- [ ] **Inputs from Jonny before drafting:** operator name (SATSEND LLC once
      formed, v1.5.8-H) and registered address; governing law and courts; legal
      and support email; minimum age (recommend **18**, as a business tool);
      which countries SatSend serves.
- [ ] **What SatSend is:** invoicing software on a flat subscription. Not a
      bank, payment processor, money transmitter, escrow agent, exchange or
      financial adviser. Never holds, receives, sends or routes funds; clients
      pay the user's own address directly.
- [ ] **The user's responsibilities:** the receiving address is theirs and
      correct; they keep their own keys; bitcoin payments can't be reversed;
      SatSend can't recover funds sent to a wrong address, wrong network or
      lost wallet.
- [ ] **Exchange rates:** the bitcoin amount uses outside price feeds at the
      moment the invoice is viewed; prices move; the 5% tolerance rule and what
      Underpaid / Overpaid mean; no guarantee the rate is exact.
- [ ] **Payment tracking:** statuses come from outside blockchain services
      (mempool.space), may be late or wrong, and "Paid" is information, not a
      guarantee; check your own wallet. No liability for outages of outside
      services.
- [ ] **Taxes and compliance are the user's:** sales tax / VAT on their
      invoices, income tax, any licences. SatSend gives no tax, legal or
      financial advice.
- [ ] **Acceptable use:** no illegal goods or services, fraud, impersonating
      another person or company, phishing, spam, or sanctioned people and
      places. SatSend may suspend invoices or accounts that break this
      (v1.5.2.16-H builds the tools).
- [ ] **Pro:** price; monthly/yearly; card renews until turned off, bitcoin
      doesn't; cancelling; refunds within 15 days for card and bitcoin (and how
      a bitcoin refund is valued: the dollar amount paid, at the rate on the day
      of the refund); fair-use limit (500 saved clients); price changes with
      notice; what happens when Pro ends (v1.5.6-H).
- [ ] **The usual protections:** service "as is"; no warranty of uptime;
      liability capped (e.g. to fees paid in the last 12 months); user
      indemnifies SatSend for their invoices and dealings with clients;
      suspension and termination; changes to the terms with notice by email;
      the source code's FSL licence is separate from the right to use the
      hosted service.
- [ ] **Payers (the user's clients)** see invoices without an account: a short
      "Using this invoice" section they're linked to (v1.5.2.15-H).
- [ ] **Lawyer review** before Pro takes money (budget it), then publish. Keep
      a dated version history at the bottom of the page.

### ⏳ v1.5.2.7-H — Privacy policy (`/privacy`) (**pre-launch**, moved up)

> Was a one-line placeholder. **Must be live before Pro.** Drafted from what the
> code actually stores and sends; same lawyer review as v1.5.2.8-H.

- [ ] **What's collected and why:** account email; invoice contents the user
      chooses to add (their name, company, address, tax ID; their client's
      details); receiving addresses; access codes; sign-in and email-delivery
      records; scrambled connection fingerprints for rate limits (never raw IPs
      in the database; Vercel keeps request logs).
- [ ] **Who it's shared with** (sub-processors): Supabase (database, sign-in),
      Vercel (hosting), Resend (email), mempool.space (address lookups),
      Coinbase / CoinGecko (prices; no personal data sent), cron-job.org and
      GitHub Actions (timers; no personal data), the card provider once chosen.
      Where each stores data.
- [ ] **Clients' data:** for the details users enter about their clients,
      SatSend acts for the user (a "processor"); say so, and offer a data
      processing addendum for business users who need one (v1.5.2.20-H).
- [ ] **Cookies:** only essential ones (sign-in, access-code unlock); no
      analytics or advertising, so no cookie banner. Re-check if that changes.
- [ ] **Rights and how to use them:** access, correction, export, deletion
      (v1.5.7-H), objection; how to complain to a regulator.
- [ ] **Retention:** how long each kind of data is kept (v1.5.2.20-H sets the
      numbers).
- [ ] **International transfers, children (18+ only), changes, contact.**

### ⏳ v1.5.2.15-H — Legal page (`/legal`), agreeing at sign-up, and notices for payers (**pre-launch**)

- [ ] **`/legal`**: one page linking Terms, Privacy, Acceptable use (a section
      of the Terms), Cookies (a section of Privacy), DMCA (v1.4.34), Licence
      (FSL), Security, Accessibility statement (v1.5.2.19-H), and the company's
      details (legal name, registered address, contact). Footer: the "Legal"
      heading links to it.
- [ ] **Sign-up:** "I'm 18 or over and agree to the Terms and Privacy policy",
      required (moves v1.4.34 item 1 here). Record which terms version was
      accepted and when (migration). When the terms change materially, email
      users and ask again at next sign-in.
- [ ] **Invoice pages, PDFs and invoice emails (payer side):** a short footer:
      "SatSend provides the software only. You pay [sender] directly and SatSend
      never holds the money. Bitcoin payments can't be reversed: check the
      address matches what [sender] gave you." Plus links to Terms, Privacy and
      "Report this invoice" (v1.5.2.16-H). Near the amount: "Worked out at
      today's rate when you opened this invoice."
- [ ] Tests: sign-up can't complete without the box; the acceptance record is
      written; every public invoice view and email carries the footer.

### ⏳ v1.5.2.16-H — Abuse and fraud handling (**pre-launch**)

> A scammer could use SatSend to send convincing invoices pretending to be
> another company, or to send spam from SatSend's email domain. Both harm the
> people paying and SatSend's email reputation.

- [ ] "Report this invoice" on every public invoice: a short form (reason,
      optional contact), rate-limited, emailed to the support inbox.
- [ ] A way to switch off one invoice or a whole account, run by Jonny from a
      protected script or the database (server-side only; no admin screens in
      the app). A switched-off invoice shows "This invoice is no longer
      available."
- [ ] A daily cap on invoice emails per account (Free and Pro), so SatSend
      can't be used to blast emails. Generous for real use.
- [ ] Written steps for handling a report (check, switch off, reply, keep a
      record), linked from the Terms' acceptable-use section.

### ⏳ v1.5.2.17-H — Security launch checks (**pre-launch**)

> From Supabase's security advisor on production (2026-10-27) and the launch
> security checklist. Small fixes plus settings.

- [ ] **Migration:** revoke `EXECUTE` on `broadcast_invoice_status_change()`
      from `anon` and `authenticated` (it's a trigger function, callable over
      the API today; harmless in practice, but should be closed). Set
      `search_path = ''` on `set_updated_at`, `line_items_valid`,
      `protect_paid_invoice_fields` and `block_non_draft_delete`. Re-run the
      advisor: only the deliberate "RLS on, no policies" notices remain.
- [ ] **Supabase Auth settings** (Jonny, in the dashboard, Claude lists the
      exact switches): turn **off email + password sign-in** (SatSend only uses
      email links, so a password route is an unused way in; the advisor's
      "leaked password protection" warning then doesn't apply); confirm the
      email-link rate limits and link expiry; production site URL and redirect
      list only.
- [ ] **Stricter Content-Security-Policy** (deferred from v1.4.24-H): limits
      which scripts can run, the main defence against script injection stealing
      a signed-in session. Must allow the live mempool.space and Supabase
      connections, so test payment updates end to end.
- [ ] **`/.well-known/security.txt`** pointing at the contact route the
      Security page names.
- [ ] **Decide:** optional two-factor sign-in (an authenticator app) for
      accounts. An email takeover could otherwise change the address on new
      invoices. Recommend: after launch, as its own item.
- [ ] Add "run the Supabase security advisor" to the `migration-safety` skill's
      after-applying steps.

### ⏳ v1.5.2.18-H — Commercial hosting, outside services' terms and spending caps (**pre-launch, before Pro**)

- [ ] **Vercel:** the Hobby plan is for personal, non-commercial use only.
      Move to Pro before charging for Pro (ideally at launch). Then turn on
      **Spend Management with a hard pause** so an attack or bug can't run up a
      bill. Check the firewall rule carries over and add any extra rules Pro
      allows.
- [ ] **Supabase:** move to Pro for daily backups and no pausing; keep the
      **spend cap on**; set usage alerts.
- [ ] **Outside services' terms for commercial use:** mempool.space public API
      (fair-use limits; consider their paid plan or a fallback), CoinGecko
      (free plan terms and attribution), Coinbase price API, cron-job.org,
      Resend (sending limits). Record each answer in the roadmap.
- [ ] **Runaway costs:** confirm nothing can call itself in a loop (the sweep,
      webhooks, emails), every scheduled job has a time and size limit, and
      billing alerts go to Jonny's email.

### ⏳ v1.5.2.19-H — Accessibility (WCAG 2.2 AA) and an accessibility statement (**pre-launch**)

> Accessibility lawsuits are common against small sites too. The design system
> already uses focus rings and labels; this checks it properly.

- [ ] Automated checks (axe) in the test suite for the homepage, marketing
      pages, sign-up, dashboard, invoice form and public invoice page.
- [ ] Keyboard-only pass of every main flow (create, send, pay view, access
      code, settings); fix anything unreachable or hidden focus.
- [ ] Colour contrast, especially amber on light backgrounds; alt text on
      every meaningful image (the QR code's alt text says what it's for).
- [ ] Accessibility statement on `/legal`: the standard aimed for, known gaps,
      how to report a problem.

### ⏳ v1.5.2.20-H — Data protection housekeeping (**pre-launch, before Pro**)

- [ ] Accept the data processing agreements of Supabase, Vercel and Resend
      (and the card provider), and note each one's data region.
- [ ] Retention: decide how long to keep email-delivery records, webhook
      records and deleted-account leftovers; a scheduled clean-up for each.
- [ ] **Export:** a user can download all their invoices (CSV, plus PDFs) from
      settings, which covers the right to a copy of their data and helps before
      account deletion (v1.5.7-H).
- [ ] A data processing addendum for business users (template, linked from
      Privacy).
- [ ] A short breach-response runbook: who checks what, how to rotate keys,
      and the 72-hour notification rule under UK/EU GDPR.

---

### ⏳ v1.5.2.5-H — About page (`/about`)
- [ ] Who's behind SatSend and why it exists. **Needs a few lines from Jonny.**

### ⏳ v1.5.2.6-H — Contact page (`/contact`)
- [ ] How to get in touch. **Needs the support email address from Jonny.**

### ⏳ v1.5.2.9-H — SatSend accounts on X, LinkedIn and GitHub
- [ ] Jonny creates the accounts (a GitHub organisation for the repo).
- [ ] **Move the codebase to the SatSend GitHub account** (Jonny, 2026-10-21):
      transfer `jonnymarshall/SatSend` to the organisation (GitHub keeps
      redirects), then update the git remote, the CI and payment-sweep
      workflows' secrets/variables, Vercel's Git connection, and branch
      protection (`scripts/enable-branch-protection.sh`).
- [ ] **After the move above,** put the real URLs in `SOCIAL_LINKS` in
      `src/lib/site-links.ts`. The GitHub one feeds the homepage's "View the
      code", the footer's GitHub link, and the Security page's "View the code"
      and "open an issue on GitHub" (v1.5.25); point the issue link at the
      repo's `/issues`. Then `/coming-soon` has no users: delete it.

### ⏳ v1.5.8-H — Form SATSEND LLC and give it the code (**pre-launch**)

> `LICENSE.md` names **SATSEND LLC** as the copyright holder (Jonny,
> 2026-10-21), but the company doesn't exist yet. Until it does, the code is
> legally Jonny's.

- [ ] Form SATSEND LLC (exact registered name to match `LICENSE.md`; update the
      notice if it differs).
- [ ] Assign the code to the LLC in writing (a short IP assignment from Jonny),
      covering everything written before it was formed.
- [ ] Use the LLC for the card-payment provider (v1.5.4-H), the privacy policy
      and terms (v1.5.2.7-H, v1.5.2.8-H).
- [ ] **Added 2026-10-27 (legal and compliance train):** a trademark search for
      "SatSend" before launch (and consider registering it); an accountant for
      the LLC's tax filings; consider professional liability (errors and
      omissions) and cyber insurance; keep the LLC's money separate from
      personal money so the LLC protects you.

### ⏳ v1.5.7-H — Account deletion (**pre-launch**)

> Agreed 2026-10-21. The FAQ already says "contact support and we'll delete your
> account and your invoices"; privacy law in many places expects this.

- [ ] Until built: a support request does it by hand. Document the steps
      (delete the user's invoices, events and email log, then the auth user).
- [ ] Decide: self-serve "Delete my account" in settings, or support only.
- [ ] Decide what happens to invoices a client may still need (warn first; offer
      to export PDFs).
- [ ] Mention in the privacy policy (v1.5.2.7-H).

### ⏳ v1.5.2.11-H — Phones: invoice list as stacked rows
- [ ] Moved out of v1.5.2-H. On phones, show the invoice table as stacked rows
      instead of sideways scrolling. A layout change, so it needs Jonny's decision.

### ⏳ v1.5.2.14-H — Short invoice reference in links, invoices, emails and PDFs (**pre-launch**)

**Branch:** `v1.5.29/short-invoice-reference` · package `1.5.29` (moved from
1.5.28 for v1.5.2.21-H) · new migration (the next free number when it starts;
v1.5.27 took `0037`). Renumber the package if another item ships between this
plan and the branch.

**Context.** Two linked requests from Jonny (2026-10-26):

1. **Shorter links.** The public invoice URL exposes a 36-character UUID
   (`.../invoice/d646495a-bae1-4a8d-9e23-a82731cd7d20`). It should use the
   shortest unique alphanumeric identifier we can safely issue, so the link is
   easy to read, type and share.
2. **Show it everywhere.** The same identifier should appear on the invoice
   itself for both the owner and the client, and in every invoice email and
   PDF, so either side can quote it instead of the owner's own invoice number
   (which is often unpredictable or inconsistent between suppliers).

**Approach.** Add a public **reference** to each invoice and keep the UUID as
the internal primary key. The UUID stays behind the scenes (foreign keys,
`invoice_events`, `email_events`, realtime channels, logs); every client-facing
surface swaps the UUID for the reference. This gives the short URL and the
short printed ID without rewriting every foreign key and realtime channel.

> **Why not make the short string the primary key?** It would ripple through
> every foreign key, event table, realtime policy and later the API, and any
> future reference change would become a data migration. A unique indexed
> column achieves the same visible result with a much smaller blast radius. If
> the actual primary key must change, treat that as a separate, larger item.

**Decision needed before implementation: the label.** "Invoice ID" is out: it
is the exact collision with the owner's invoice number that this item is meant
to remove. Options used in industry:

| Label | Notes |
|---|---|
| **SatSend reference** | Names the issuer, so it cannot be mistaken for the owner's invoice number or the client's own reference or PO. **Recommended.** |
| **Reference** / **Invoice reference** | The standard accounting term, but accounting software often uses "Reference" for the client's PO or buyer reference, so it can still collide. Good as shorthand once the context is clearly SatSend. |
| **SatSend ID** | Makes ownership clear, but "ID" reads technical. |
| **Reference number** | Explicit but wordier than "Reference". |
| **Payment reference** | Banking language; risks confusion with the Bitcoin transaction ID. Avoid. |
| **Invoice ID** | Avoid, for the collision above. |

Pick one label and use it verbatim on the owner page, the client page, the
PDF, every email, the dashboard list, support copy and the later API field.
Where both numbers appear together, label them distinctly (for example
"Invoice number" for the owner's own number and "SatSend reference" for ours)
so a client cannot mix them up.

**Part A: short reference and short links**

- [ ] **Migration.** Add `invoices.reference text`, nullable at first; backfill
      every existing row; then add a global unique index and `not null`. New
      invoices get a reference at creation. Do not remove or rewrite `id`.
- [ ] **Format.** Fixed-length uppercase Crockford base32. The alphabet leaves
      out `I`, `L`, `O` and `U`, so it cannot be misread as `1` or `0` when
      read aloud or copied by hand. **Recommended 8 characters** (about 40
      bits): short enough to read aloud, long enough that collisions stay rare
      with a unique index and retry. Six characters (about 30 bits) is the
      practical floor: it still gives roughly a billion combinations, but the
      collision rate and the enumeration rate both rise, so use it only if
      link length matters more than those margins. Confirm 8 versus 10 during
      planning; do not go below 8 without measuring the retry rate.
- [ ] **Generation.** Server-side from `crypto.randomBytes`, retrying on a
      `23505` unique violation. Do not derive it from the UUID or from an
      increasing counter: that would leak invoice volume and make references
      predictable.
- [ ] **Resolver.** One helper (extend `fetchPublicInvoice` or add
      `fetchInvoiceByIdOrReference`) that matches `reference` first and falls
      back to `id`. Uppercase the input before lookup, so a hand-typed
      lowercase reference still works. Every public route uses it:
      `/invoice/[ref]`, `/api/invoice/[ref]/pdf` and
      `/api/invoices/[ref]/payment-status`. UUID links already in clients'
      inboxes keep working; no redirect is needed.
- [ ] **Access cookie.** Resolve to the invoice's UUID before reading or
      writing `accessCookieName`, so an invoice unlocked through an old UUID
      link stays unlocked on the new short link, and the other way round.
- [ ] **Realtime.** Keep the channel keyed on the UUID, not the reference, so
      the existing subscriptions and broadcast policy do not change.
- [ ] **Link builders.** Build new public invoice links from the reference in
      `src/lib/email/send.ts` and the public PDF route. Pass the reference into
      the email context instead of reusing `invoiceId` for the URL. The
      dashboard URL may stay UUID-based (it is not shared with clients); still
      show the reference there. Decide in the PR whether to switch dashboard
      URLs too, for consistency.
- [ ] **PDF filename.** Replace the `...${id.slice(-8)}` fallback in
      `src/lib/invoices/pdf-filename.ts` with the reference, so an invoice
      without a number still saves with a readable name.

**Part B: show it on every surface**

- [ ] **Owner invoice page** (`/invoices/[id]`): a labelled reference with a
      copy button, next to the owner's invoice number.
- [ ] **Client payment page** (`/invoice/[ref]`): the same label and reference
      near the heading, quiet enough not to compete with the amount due.
- [ ] **PDF** (`src/lib/invoices/invoice-pdf.tsx`): print it in the header or
      meta block alongside, not instead of, the owner's invoice number.
- [ ] **Emails.** Add the reference to every invoice template that names the
      invoice: `invoice_published`, `payment_detected_owner`,
      `payment_detected_payer`, `payment_confirmed_owner`,
      `payment_confirmed_payer`, and the overdue templates when v1.4.20 lands.
      Use one shared row/component so the label and formatting cannot drift.
      Keep the subject line as it is unless testing shows the reference reads
      better there; do not make the subject longer.
- [ ] **Invoice list** (`/invoices`): show it in the row, either as a column or
      under the invoice number. Optional for this item; the required surfaces
      are the two invoice pages, the emails and the PDF.
- [ ] **Copy affordance.** One click copies the bare reference (no prefix, no
      URL) and shows the existing "Link copied"-style notice.
- [ ] **Docs.** Update `README.md` and any docs that describe the invoice URL
      shape.

**Security note.** The reference is an identifier, not a secret. Shortening
it from a UUID raises the theoretical chance of someone finding an invoice by
trying references. That is acceptable: private invoices still require the
access code, wrong guesses are rate-limited (v1.5.2.12-H), and invoices
without a code are already public by link. Do not weaken either control to
compensate. At 8 characters with the existing 30 requests per 60 seconds per
IP limit, enumeration is not practical.

**Tests**

- [ ] Format: every generated reference has the agreed length, uses only the
      Crockford alphabet and is uppercase.
- [ ] Uniqueness: the unique index rejects a duplicate, and the generator
      retries with a different value.
- [ ] Backfill: every existing invoice has a non-null reference and no two
      share one (test database first; production at merge).
- [ ] New invoice links in emails contain the reference, not the UUID; the
      public PDF route builds from the reference.
- [ ] The resolver accepts both forms; an old UUID link opens the same invoice
      and the access unlock carries across.
- [ ] Owner page, client page, PDF and each email template render the agreed
      label and the reference.
- [ ] Old UUID links keep working after the migration (regression guard).
- [ ] The copy button writes the bare reference to the clipboard.

**Manual verification**

- [ ] Create and send a test invoice: the email link is short, opens the
      invoice, and the same reference appears on the page and in the PDF.
- [ ] Open an invoice using its old UUID link; it still works.
- [ ] Enter the access code through the old link, then open the new short
      link; no second code is asked.
- [ ] Download the PDF with no invoice number set; the filename contains the
      reference.

**Out of scope**

- Replacing the UUID primary key or changing foreign keys.
- Sequential or owner-customisable reference numbers; this is an opaque
  identifier, not a numbering scheme.
- Replacing the owner's invoice number. The two coexist, and the owner keeps
  control of their own number.
- Pretty links (v2.1) and client pages (v2.3). They should consume the
  reference once it exists, but they are separate items.
- API changes (v2.8). The API can accept and return the reference when it is
  built.

**Done when:** every new invoice has a short, unique, human-readable
reference; every client-facing link, the owner page, the client page, every
invoice email and the PDF show it under one agreed label; old UUID links still
resolve; and no UUID appears in a URL or document a client sees.

### ⏳ v1.5.3-H — Multi-currency support (moved from v2.12; **pre-launch**)

**Branch:** `v1.5.3/multi-currency`

> Moved before launch (Jonny, 2026-10-21): the homepage says "create your invoice
> in your local currency", which is only true for USD until this ships.

- [ ] Currency selector on invoice creation (USD, EUR, GBP, AUD, CAD, etc.)
- [ ] BTC price fetched in the selected fiat currency
- [ ] Dashboard shows currency alongside invoice totals
- [ ] Widen the `currency_whitelist` constraint (Appendix A: money invariants).

---

### ⏳ v1.5.4-H — Card payments for Pro (**pre-launch**)

> **Decided by Jonny, 2026-10-21:** "accepting fiat payments is going to be
> pretty crucial from launch date." This **replaces the "Bitcoin-only at launch
> (hard rule)"** in the monetisation plan below. The /pricing page already says
> Pro can be paid by card.

- [ ] Choose the provider. The old blocker still applies: the operator is a
      foreign LLC with no business bank account, so check what each can pay out
      to. A merchant of record (Lemon Squeezy, Paddle) also handles sales tax;
      Stripe needs a supported entity and bank account.
- [ ] Card payments **renew automatically** (monthly or yearly) until turned off,
      which the customer can do at any time; bitcoin payments don't renew.
      Renewal terms shown next to the subscribe button (v1.4.34 item 5).
- [ ] A card payment or renewal extends `premium_until`, the same entitlement
      model as bitcoin (one source of truth: `getEntitlements`).
- [ ] Refunds: on request within 15 days of paying (the /pricing FAQ promises
      this), for card and bitcoin. Decide how a bitcoin refund is sent.
- [ ] Prices: $10/month or $100/year (2 months free), the same for both rails.
- [ ] **Tax on SatSend's own sales** (legal and compliance train, 2026-10-27):
      selling subscriptions worldwide brings VAT / sales tax duties. A merchant
      of record collects and pays these for card sales; bitcoin sales of Pro
      still owe them, so ask an accountant how to handle those (or route Pro
      through the merchant of record only, with bitcoin as a manual exception).
- [ ] Annual renewals: email a reminder before the renewal date, and make
      cancelling online as easy as subscribing (auto-renewal laws, e.g.
      California).

### ⏳ v1.5.5-H — Consider free trials of Pro (**decide before launch**)

> Jonny, 2026-10-21: "I want to at least think about this before launch."

- [ ] Decide: a trial or not; length; card required up front or not; what
      happens at the end (falls back to Free, per v1.5.6-H).
- [ ] If yes: how it shows on /pricing and the homepage cards, and abuse limits
      (one trial per person, not per throwaway email).

### ⏳ v1.5.6-H — Moving between Free and Pro (**decide before launch**)

> Jonny, 2026-10-21: consider how accounts move from Free to Pro and back,
> including how invoices created **before** the change are handled after it.

- [ ] Upgrade: do existing invoices pick up Pro features (branding on their
      page and PDF, your company name on emails still to send, reminders)?
- [ ] Downgrade or expiry: what happens to invoices created on Pro, their client
      pages and your own link; saved clients beyond the Free limit of 1;
      reminders already scheduled; branding on PDFs already sent.
- [ ] Rule of thumb to confirm: nothing a client already has should break, and
      no invoice is ever lost. The /pricing FAQ promises "you keep all your
      invoices, including the ones you created on Pro"; keep that true.
- [ ] Write the decisions into v2.0's entitlement model and the terms (v1.5.2.8-H).

### ⏳ v1.5.0.4-H — DMARC: tighten `p=none` → `p=quarantine` (**not before 2026-11-08**)

**Branch:** none needed (a DNS change in Namecheap, done by Jonny) · **Date-gated.**

> **If this item comes up before 2026-11-08: do not do it.** Move this whole
> section further down the queue (below the next item), keep the date, and carry
> on with the next item. Only do it on or after the date, and only if the checks
> below pass.

**Why.** `p=none` (set 2026-10-10) asks inboxes to check SPF/DKIM and *report*
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

### ⏳ v1.6 — Bitcoin Enhancements

**Branch:** `v1.6/btc-enhancements`

- [ ] Optional BTC discount field on invoice creation (% value, e.g. 5%)
- [ ] Discount only applies if the invoice is paid in Bitcoin — shown on the client payment view as a line item reducing the BTC amount
- [ ] Discount displayed on client view alongside the BTC amount (e.g. "5% BTC discount — save $X")
- [ ] Discount not reflected in the fiat total; it is a BTC-payment incentive only

**Done when:** A freelancer can offer a percentage discount to clients who pay in BTC, visible only on the payment view.

---

### ⏳ v1.7 — Address Format Standardisation (**pre-launch**)

**Branch:** `v1.7/address-fields`

> **Note:** This branch changes the address data model. Must land **before launch**
> (Jonny, 2026-10-21: sender and client addresses become proper address forms, not
> one text box), and before v2.2 (saved clients) since those features depend on the
> address structure.

- [ ] Replace the single freeform `your_address` / `client_address` text fields with structured fields: Line 1, Line 2, City, State/Province/Region, Post Code, Country, following the UN/OASIS xNAL address standard ordering
- [ ] **Maximally compatible with any address globally:** Line 1 and Country are the only required fields; Line 2, City, State/Province, and Post Code are all optional (many countries have no postcode or region concept); no country-specific format validation (no US-style ZIP/state rules); generous length limits
- [ ] Country picked from the ISO 3166-1 country list (searchable dropdown), stored as the ISO code and rendered as the country name
- [ ] Schema migration: add individual address sub-columns (nullable); keep old `*_address` column for migration only, then drop after backfill
- [ ] Update invoice form with the new multi-field address layout
- [ ] Update every surface that renders an address: invoice detail page (user view), client payment view, and the PDF (`invoice-pdf.tsx` prints both addresses today). Skip empty optional lines so no blank gaps appear
- [ ] No auto-fill or address lookup required

**Done when:** all address inputs are structured multi-field forms that accept any address format in the world (no forced region or postcode), the old freeform address column is removed, and the dashboard, client payment view, and PDF all render the structured address neatly with empty optional lines omitted.

---

## v2 — Growth (Monetisation + Ecosystem)

> Goal: Launch a free tier and a paid (Pro) tier, then expand the creator experience.

> **This is the launch monetisation plan.** It replaces the earlier "premium, feature-gated later" sketch. The free/paid split, the email rules, and the build order below are agreed. The `v2.x` numbers are IDs; the **Phase** labels are the build order.

### Monetisation plan (free vs Pro)

**Philosophy**
- Invoicing is **unlimited on both tiers**. Volume caps are a losing game (throwaway emails defeat them) and the per-invoice cost is near zero: an unpaid invoice is polled roughly 7 times over ~48 min, then hibernates. Monetise **features**, not volume.
- Keep the core loop free forever: create an invoice, the payer pays, both sides are told. Sell polish, automation, and integration.
- Gate on what costs real money per use (client email to arbitrary recipients, API resources) and on what a freelancer will happily pay for (looking professional, chasing late payers).

> **Corrected by Jonny, 2026-10-21** (the earlier text made all client email
> Pro-only). **Price: Pro is $10/month or $100/year (2 months free), paid in
> bitcoin or by card** (card added 2026-10-21, v1.5.4-H). The homepage pricing
> cards (v1.5.16) show this split.

**Free**
- Unlimited invoices, BTC payment detection, share link, PDF, dashboard.
- Owner-facing "payment detected" and "payment confirmed" emails (the "you got paid" pair). This is the heartbeat of the product and stays free.
- **Invoices emailed to the client, sent as "SatSend".**
- **1 saved client.**
- No pretty links, client pages, branding, reminders, reports, or API.

**Pro**
- Pretty links (`satsend.me/theircompanyname`) and client pages (`satsend.me/theircompanyname/<client>`).
- Saved clients (up to 500, shown as "Unlimited"; the cap is fair use, in the terms) + reusable line items.
- Custom branding (logo, colours) across the invoice page, PDF, client page, and emails.
- Client email sent **from the owner's company name**, with reply-to the owner (Free sends it as "SatSend").
- Payment reminders.
- Financial reports + export.
- API access.

**Email rules (locked)**
- **Client email (sending the invoice) is on both plans.** Free sends as "SatSend"; Pro sends as the owner's company name. **Payment reminders are Pro-only.**
- **Owner-facing payment notifications stay free.** Rule of thumb: if the system is *telling the owner something happened*, free; if it is *doing work for them* (sending to clients, chasing, digests), Pro.
- **Custom sender = display name only**, e.g. `Acme Studio <team@mail.satsend.me>`, with reply-to set to the owner's email so replies reach them. **Never** the owner's own domain: that needs the user to configure DNS, and misconfiguration sends their mail to spam and creates support load. Out of scope permanently unless demand appears.
- **Do not gate payer-page live updates.** That is the *payer's* experience and the payer will never be the customer. Gating it punishes the wrong person.

**Entitlement model (locked)**
- Store one column: `premium_until timestamptz`. `isPremium = premium_until > now()`. No separate `tier` column and **no downgrade cron**; expiry is automatic. Use `infinity` for lifetime / grandfathered accounts.
- One central helper, `getEntitlements(userId)`, returns the flags. Every gated surface calls it and nothing else, so changing the paid feature list later is a one-file change.

**Billing (locked)**
- ~~**Bitcoin-only** at launch (hard rule).~~ **Superseded 2026-10-21:** card payments are needed from launch (v1.5.4-H). The reason it was bitcoin-only (a foreign LLC with no business bank account) is now the first thing v1.5.4-H must solve.
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
- **Later:** v2.9, v2.10, v2.11, v2.13, v2.14 (v2.12 multi-currency moved before launch as v1.5.3-H)

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
- ~~Refund policy (likely none; bitcoin is final).~~ Decided 2026-10-21: refund on request within 15 days of paying (/pricing FAQ).
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
- [x] Decided (2026-10-21): **1 saved client on Free, up to 500 on Pro** (shown as "Unlimited"). Enforce through `getEntitlements`.

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

**Context:** Today email goes out from `SatSend <team@mail.satsend.me>` to both owner and payer. This entry makes a Pro user's client email look like it came from them. **Client email stays free** (corrected 2026-10-21): Free keeps sending as "SatSend".

**Scope**
- [ ] **Do not gate client email.** Pro only changes the sender name and reply-to.
- [ ] **Display-name sender**: send as `<owner company> <team@mail.satsend.me>`, with reply-to set to the owner's email. Built branding-aware (v2.4).
- [ ] Free users: client email unchanged (sent as "SatSend").
- [ ] Owner notification emails stay free and unchanged.

**Out of scope (permanently)**
- Sending from the owner's own domain. It requires the user to configure DNS; misconfiguration routes their mail to spam and creates support load. Revisit only on real demand.

**Done when:** A Pro user's client email arrives from the owner's display name with replies going to the owner; a free user's client email still arrives, from "SatSend".

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

> **Also:** replace the `/developers/api` "Coming soon" placeholder (v1.5.16) with the API docs page.

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

### 🚫 v2.12: Multi-currency support — moved

Moved before launch as **v1.5.3-H** (2026-10-21).

---

### 🚫 v2.13: Lightning payments (non-custodial, LNURL + LUD-21)

**Branch:** `v2.13/lightning-payments`

**Later (post-launch).** Free for everyone (locked by Jonny, 2026-10-21): a payment
rail is part of the core loop, not a Pro feature.

**Context:** Today the only rail is on-chain BTC to a fresh address, detected via
mempool.space. Lightning adds instant settlement, exact amounts (no
underpaid/overpaid), and no confirmation wait. Feasibility was checked in a ChatGPT
architecture conversation (2026-10-21,
[transcript](https://chatgpt.com/share/6ad91472-e56c-83e8-bb31-abdc84f21c6b)): a
fully non-custodial Lightning flow is possible without a processor like Spark or
Voltage by combining LNURL-pay ([LUD-16](https://github.com/lnurl/luds/blob/luds/16.md)
Lightning Addresses, [LUD-06](https://github.com/lnurl/luds/blob/luds/06.md)
payRequest) for invoice generation with
[LUD-21 (LNURL-verify)](https://github.com/lnurl/luds/blob/luds/21.md) for
settlement detection. The payer pays the owner's wallet directly; the platform
never holds or routes funds, keeping the non-custodial principle intact.

**Why account-level address reuse is safe here (differs from on-chain):** a
Lightning Address is only an identifier. Every payment requests a fresh BOLT-11
invoice from the owner's wallet provider, with a unique payment hash and its own
LUD-21 verify URL, so per-payment tracking is unaffected by reusing the address.
Lightning payments also leave no public ledger to scrape, which is exactly what
makes on-chain address reuse unacceptable. Decision (Jonny, 2026-10-21): one
Lightning Address saved in settings as the account default, with an optional
per-invoice override.

**The catch:** LUD-21 is optional. Almost any Lightning Address can generate an
invoice, but only some wallets expose a verify URL, and Lightning has no public
mempool to watch. This version is therefore LUD-21-only: if the wallet cannot
verify, Lightning is not offered on that invoice and the owner is told why. The
Nostr Wallet Connect fallback is investigated separately (v2.14).

**Scope**
- [ ] Lightning Address in settings (account default) plus an optional per-invoice
      override. Validate at save time: resolves via LUD-16
      (`https://<domain>/.well-known/lnurlp/<user>`), sane min/max amount range.
- [ ] Per-invoice payment-method toggles: on-chain and/or Lightning, at least one
      required. This relaxes the publish-time rule that `btc_address` is mandatory
      (v1.4.14): it is required only when on-chain is enabled, and a Lightning
      Address (override or account default) is required when Lightning is enabled.
- [ ] Invoice generation at payment time: resolve the address (LUD-16), request a
      BOLT-11 invoice from the callback for the quoted amount in millisatoshis
      (LUD-06), show it as a QR code and a copyable string on the payment view.
- [ ] Persist per-invoice Lightning state: the BOLT-11 `pr`, the `verify` URL, the
      payment hash, and the fiat-to-sats quote snapshot (same quote-lock
      discipline as on-chain).
- [ ] LUD-21 gate: if the callback response has no `verify` field, Lightning is
      not offered for that invoice; the owner gets a clear "your wallet does not
      support payment verification" message at save/publish time, not a silent
      failure.
- [ ] Detection: the payment sweep polls the `verify` URL for Lightning-enabled
      unpaid invoices on the existing schedule. On `settled: true`, hash the
      returned preimage and require it to match the invoice's payment hash before
      flipping straight to `paid` (Lightning settles the exact amount atomically:
      no `payment_detected`, `underpaid`, `overpaid`, or confirmation-depth
      states).
- [ ] Emails: the owner and client payment-confirmed pair fires once on
      settlement (the detected/confirmed split is an on-chain artifact).
- [ ] SSRF hardening on every server-side LNURL fetch (the address domain and the
      callback URL are both untrusted input): https only, block
      private/link-local IPs, bounded redirects, timeouts, response size caps.
- [ ] Payment view rail picker when both rails are enabled (tabs or toggle), with
      the same live-update treatment as on-chain.

**Tests**
- [ ] LNURL resolution and invoice generation against a mocked LNURL server.
- [ ] Verify-poll: `settled: true` with a preimage hashing to the payment hash
      flips the invoice to `paid`; a mismatched preimage does not; `settled:
      false` leaves it unpaid.
- [ ] A wallet whose callback omits `verify` is rejected with the clear message,
      at save time and at publish time.
- [ ] SSRF guard: callback URLs pointing at loopback/private ranges or non-https
      are refused.
- [ ] Publish rules: a Lightning-only invoice publishes without a `btc_address`;
      an invoice with both rails off cannot publish.

**Decisions to lock in (grilling session)**
- Rail picker UX when both rails are on (which rail is presented first).
- Quote lock for Lightning: BOLT-11 invoices carry their own expiry; align the
  fiat-to-sats quote window with it, and decide the re-issue flow when a payer
  lets an invoice lapse.
- Whether the manual mark-as-paid backstop stays available on Lightning invoices
  (it exists on every invoice today; with no public ledger, the owner is the only
  witness).
- Support raw bech32 LNURLs (LUD-06) in addition to the `user@domain` Lightning
  Address form (LUD-16), or Lightning Addresses only.
- Which wallets to test against at build time (LUD-21 support matrix).

**Out of scope (deferred)**
- Nostr Wallet Connect verification: tracked as v2.14.
- Custodial anything: no node, no keys, no Spark/Voltage-style processor.
- Lightning for platform billing (v2.0 premium payments): possible follow-on, not
  this item.
- Buyer-supplied preimage proof as a verification path (the weakest option in the
  feasibility check; revisit only on real demand).

**Done when:** an owner saves a Lightning Address in settings, publishes an
invoice with Lightning enabled (alone or alongside on-chain), and a client pays
the BOLT-11 invoice from their own wallet; SatSend detects settlement via the
LUD-21 verify URL, validates the preimage against the payment hash, flips the
invoice to `paid`, and sends the confirmation emails, with the money moving
directly between the client's and owner's wallets and the platform never in the
flow. An owner whose wallet lacks LUD-21 gets a clear explanation instead of a
silent failure.

---

### 🚫 v2.14: Investigate Nostr Wallet Connect (NWC) for Lightning verification

**Branch:** `v2.14/nwc-lightning-verification`

**Later.** Follow-up to v2.13, flagged by Jonny (2026-10-21).

**Context:** v2.13 ships Lightning with LUD-21-only verification, which excludes
owners whose wallets expose no verify URL. Nostr Wallet Connect
([NIP-47](https://github.com/nostr-protocol/nips/blob/master/47.md)) is an open
protocol, not a hosted processor: the owner connects a compatible wallet once and
grants receive-only permissions (`make_invoice`, `lookup_invoice`), letting
SatSend create and check invoices directly with the wallet. More setup friction
than typing a Lightning Address, but considerably more reliable detection, and
self-custodial wallets can connect.

**Scope (investigation first, then a build decision)**
- [ ] Survey NWC-capable wallets and the connect UX (connection string, deep
      link).
- [ ] Confirm receive-only connections are enforceable (never request
      `pay_invoice`).
- [ ] Coverage question: does NWC meaningfully widen wallet support beyond
      LUD-21?
- [ ] Written build/no-build decision; if build, write a full roadmap entry.

**Done when:** the build/no-build decision is recorded on the roadmap, with a
full spec if build.

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

## Appendix A — Hardening execution detail (archived)

> The step-by-step detail for the 2026-07 hardening train (Phases 0 to 2, all
> done) was moved verbatim to [`ROADMAP-ARCHIVE.md`](./ROADMAP-ARCHIVE.md) on
> 2026-10-27, under "Appendix A (archived 2026-10-27)". Appendix B below still
> holds the findings reference.

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
