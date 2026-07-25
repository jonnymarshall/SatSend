# SatSend — Hardening Roadmap (execution plan)

> **`ROADMAP.md` is the single source of truth for sequence.** Every item below
> is listed there (as `v1.4.NN-H`) in the order to do it. This document holds only
> the detailed numbered steps for each item — open the matching S-number or -H
> version here when you start it. If this doc and `ROADMAP.md` ever disagree on
> *what's next*, `ROADMAP.md` wins.

This turns the findings in `ARCHITECTURE-AUDIT-2026-07.md` into sequenced,
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

### S3 — Restore sub-daily detection (branch `v1.4.28/cron-strategy`)
Decided: external scheduler on Hobby tier (CRIT-5). Also fix the schedule math.

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
   `currency_whitelist` (start `('USD')`, widen when v2.6 lands);
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
  / `bulkUnarchive` reset schedule columns + clear `btc_txid`), M-MONEY-2
  (`fetchAddressTxs` throws + timeout, don't consume an attempt on failure),
  M-MONEY-3 (pick confirmed-then-unconfirmed tx), M-MONEY-5 (freshness fails
  closed). Bundle these — they all touch the detection path.
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
