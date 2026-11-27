<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:environment-rules -->
# Environments

- **One writer per database.** Exactly one live code version may run the payment
  sweep against a given database. The route at `/api/cron/payment-sweep` no-ops
  unless `PAYMENT_SWEEP_ENABLED=true` is set in that environment. Enable it in
  exactly one environment per database: the one that owns that database's sweep
  (production's sweep is owned by the external scheduler). A local session may
  enable it temporarily **only** against the local/test database, never against a
  database shared with production, and must remove the flag when the session ends.
- **Local development uses its own Supabase project.** Do not point a local
  `.env.local` at the production database.
- **Email delivery reports only reach production.** Resend's webhook points at
  satsend.me, so on a local/test site every email stays "awaiting delivery" in
  an invoice's Activity. That's expected, not a fault (R-64).
- **Never deploy a preview or branch environment that shares the production
  database** — its cron could write to live data.
- **Migrations are applied by the agent, not deferred.** Apply each migration to
  the owning database in the same session: test via `npx supabase db push` before
  the PR, production via the Supabase MCP `apply_migration` tool just before the
  merge (additive migrations; see the project brief below).
  Production once drifted two releases behind because this was left as a manual
  step.
<!-- END:environment-rules -->

<!-- BEGIN:project-brief -->
# Project brief (how to work here)

- **Never commit to `main`.** Work on a branch named for the roadmap item. `main`
  is protected: the CI `verify` check must pass and direct pushes are blocked
  (`scripts/enable-branch-protection.sh`).
- **Before any commit:** `npm run test:run`, `npm run typecheck`, and
  `npm run lint` must be green. CI enforces this on the PR; the local hooks are
  fast feedback only.
- **Before opening a PR:** run the `pre-merge-verification` skill. Bump the version
  **on the branch** (`package.json` = branch version); tag **on merge**.
- **Migrations:** apply to the **test** database before the PR (`npx supabase db
  push`). Apply to **production just before the merge** (Supabase MCP
  `apply_migration`), once the PR is approved and only if the migration is
  additive (new tables, nullable columns, functions: the old code ignores them).
  Merging deploys within minutes, so "after merge" always leaves production
  running new code against an old database; v1.5.29 ran that way for about five
  hours because the MCP was signed out. Check the MCP is connected first. A
  destructive or non-additive migration needs an agreed order instead. Never
  defer (see the environment rules above).
- **Roadmap items and release numbers are separate (2026-11-26).** Items in
  `development/ROADMAP.md` are `R-1`, `R-2`, … (old label kept as "(was
  v1.5.3-H)"); branches are `r-N/<slug>`. Release numbers (`package.json`, git
  tags) follow semantic versioning from 1.6.0: a new feature bumps the minor
  number (1.6.0 → 1.7.0), a fix the patch (1.7.0 → 1.7.1). Say both in PR titles
  and updates: "Release 1.6.0 (R-44, multi-currency)". Never re-implement an
  item marked SUPERSEDED.
- **Skills:** `next-feature` (plan the next item, then stop for approval),
  `git-workflow` (branching/SemVer), `migration-safety`, `deploy-checklist`,
  `pre-merge-verification`, `ui-element-ids` (give UI elements hierarchical ids
  so they can be named in conversation; apply on any UI/design work).
<!-- END:project-brief -->
