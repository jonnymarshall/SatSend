-- v1.5.32 (roadmap v1.5.2.17-H) — security launch checks.
--
-- Closes the last two kinds of warning Supabase's security advisor raised on
-- production (2026-10-27). Additive: no table, column or data changes.

-- 1. broadcast_invoice_status_change() is a trigger function (it broadcasts a
--    paid invoice's new status to the client's page). Being security definer in
--    the public schema, it was also listed as callable over the API by anon and
--    signed-in users. Calling it there only errors (a trigger function can't run
--    outside a trigger), but nobody should be able to call it at all. Triggers
--    don't need the caller to have EXECUTE, so the trigger keeps firing.
revoke all on function public.broadcast_invoice_status_change() from public, anon, authenticated;

-- 2. Four functions had no fixed search_path, so a role able to create objects
--    in a schema earlier on its path could make them resolve a name to its own
--    object. None of them refers to a table or a non-built-in function by an
--    unqualified name (only built-ins like now() and jsonb_typeof(), which always
--    come from pg_catalog), so an empty search_path changes nothing they do.
alter function public.set_updated_at() set search_path = '';
alter function public.protect_paid_invoice_fields() set search_path = '';
alter function public.block_non_draft_delete() set search_path = '';
alter function public.line_items_valid(jsonb) set search_path = '';

-- Left as is, on purpose:
--   * is_address_registered(text): signed-in users must be able to call it (the
--     invoice form's cross-tenant address check, v1.4.31-H); anon can't.
--   * "RLS enabled, no policies" on access_code_attempts, invoice_quotes,
--     signup_check_attempts and webhook_deliveries: only the server reads and
--     writes them, so no policy means no access for anyone else.
