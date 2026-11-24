---
name: migration-safety
description: Safety checklist for authoring and applying Supabase migrations. Use whenever creating or changing a file under supabase/migrations/, or applying migrations. Codifies the 0018/0019 lessons (view dependencies, NOT VALID then validate) and the 0030/0031 lessons (security-definer grants).
---

# Migration safety

## Authoring

- **Next number = highest existing + 1** (`ls supabase/migrations/`). Never reuse.
- **Additive and non-destructive by default.** For a constraint, add it `NOT VALID`
  then `VALIDATE` at the end, so a bad existing row fails the whole migration
  loudly and rolls back — instead of silently deleting or rewriting data.
- If a view uses `select *`, **drop and recreate the view** around any column
  change (Postgres refuses to alter a column a view depends on). See 0018/0019.
- **Security-definer functions** (0030/0031 lessons):
  - `set search_path = ''` and schema-qualify every reference inside.
  - `revoke all on function … from public, anon;` then
    `grant execute on function … to authenticated;`.
    Revoking from `public` is **not** enough: Supabase's default privileges
    re-grant EXECUTE to `anon`. State this explicitly.
  - After applying, **verify the grants**:
    `select has_function_privilege('anon', '<fn>', 'execute');` must be `false`
    and `authenticated` must be `true`.
- One migration = one transaction (Supabase wraps it), so keep it non-concurrent
  (no `CREATE INDEX CONCURRENTLY` in the same file).

## Applying

- **Test database first, same session** (`npx supabase db push`) — the integration
  suites need it.
- **Production just before the merge**, via the Supabase MCP `apply_migration`
  tool, once the PR is approved, for an additive migration (new tables, nullable
  columns, functions). Merging deploys within minutes, so applying it after the
  merge leaves new code running against the old database (v1.5.29: about five
  hours, because the MCP was signed out). Check the MCP is connected first
  (`list_migrations`). A destructive or non-additive migration needs an agreed
  order instead. This is the agent's job, not deferred (AGENTS.md
  environment-rules).
- Before production, run the validation queries by hand to confirm existing data
  will pass the new constraints.
- After applying, confirm the object exists and the grants are correct.
- Then run Supabase's **security advisor** on the same database (MCP
  `get_advisors`, type `security`). Only the deliberate notices may remain:
  "RLS enabled, no policies" on server-only tables, and `is_address_registered`
  callable by signed-in users. Anything new is fixed before the PR (v1.5.32).

## Trigger

The PostToolUse hook warns when a file under `supabase/migrations/` is written —
act on it with this skill.
