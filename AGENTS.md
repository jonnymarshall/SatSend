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
<!-- END:environment-rules -->
