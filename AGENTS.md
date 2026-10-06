<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:environment-rules -->
# Environments

- **One writer per database.** Exactly one live code version may run the payment
  sweep against a given database. The route at `/api/cron/payment-sweep` no-ops
  unless `PAYMENT_SWEEP_ENABLED=true` is set in that environment. Set it in exactly
  one place: the environment that should own the sweep (production, or the external
  scheduler). Never in local development.
- **Local development uses its own Supabase project.** Do not point a local
  `.env.local` at the production database.
- **Never deploy a preview or branch environment that shares the production
  database** — its cron could write to live data.
<!-- END:environment-rules -->
