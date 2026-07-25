# SatSend — Master Architecture Audit (2026-07-25)

Senior-engineer review of the whole project: code, schema, security, frontend,
tests, roadmap, docs, and the Claude Code workflow. Findings are grouped by
severity. Every CRITICAL and HIGH item was traced to specific files; the
highest-stakes ones were independently found by more than one reviewer and then
re-verified by hand against the source.

**Context for this audit:** SatSend is a serious side project, pre-launch, on
testnet only. No real BTC has moved yet. That is the one piece of good luck
running through this whole report: the money-critical bugs below are all fixable
*before* anyone can be hurt by them. They must be fixed before mainnet.

The companion document `HARDENING-ROADMAP.md` turns every actionable finding
here into sequenced, step-by-step work.

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
server-published broadcast channel (see HARDENING-ROADMAP S1).

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
