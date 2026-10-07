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
- **Never deploy a preview or branch environment that shares the production
  database** — its cron could write to live data.
- **Migrations are applied by the agent, not deferred.** After a migration merges,
  apply it to the owning database in the same session: test via
  `npx supabase db push`, production via the Supabase MCP `apply_migration` tool.
  Production once drifted two releases behind because this was left as a manual
  step.
<!-- END:environment-rules -->

<!-- BEGIN:project-brief -->
# Project brief (how to work here)

- **Never commit to `main`.** Work on a branch named for the roadmap item.
- **Before any commit:** `npm run test:run`, `npm run typecheck`, and
  `npm run lint` must be green. CI enforces this on the PR; the local hooks are
  fast feedback only.
- **Before opening a PR:** run the `pre-merge-verification` skill. Bump the version
  **on the branch** (`package.json` = branch version); tag **on merge**.
- **Migrations:** apply to the **test** database before the PR (`npx supabase db
  push`); apply to **production at merge** (Supabase MCP `apply_migration`). Never
  defer (see the environment rules above).
- **Versions** come from `development/ROADMAP.md`. Never re-implement an item
  marked SUPERSEDED.
- **Skills:** `next-feature` (plan the next item, then stop for approval),
  `git-workflow` (branching/SemVer), `migration-safety`, `deploy-checklist`,
  `pre-merge-verification`.
<!-- END:project-brief -->
