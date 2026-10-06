-- v1.4.19.1-H (S2.1) — Restore the public payer page's live updates.
--
-- The public /invoice/[id] page subscribes to a private broadcast channel named
-- `invoice:<id>`. Supabase evaluates `realtime.messages` RLS against the
-- *requested* channel topic, which it exposes through the `realtime.topic()`
-- helper. Migration 0023 wrote the policy against the `topic` COLUMN instead —
-- that column exists on the table, but it is not what the authorization check
-- sees, so the predicate never matched and every join was refused with
-- "Unauthorized: You do not have permissions to read from this Channel topic".
-- The page therefore only ever updated on a manual refresh.
--
-- Two corrections:
--
-- 1. Use `(select realtime.topic())` (the helper Supabase documents), keeping the
--    same `^invoice:[0-9a-fA-F-]{36}$` topic pattern and the
--    `extension = 'broadcast'` restriction.
-- 2. Widen from `to anon` to `to anon, authenticated`. Payers are anonymous, but
--    an owner previewing their own public link is signed in, and their socket
--    connects with the `authenticated` role — the `to anon` policy did not cover
--    that case. This adds no new exposure: the invoice UUID is already the
--    capability for anon, a draft invoice never broadcasts, and the payload is
--    only `{id, status, btc_txid}` (never the full row).
--
-- The trigger function and the client hook are unchanged; this is a policy-only
-- correction.

drop policy if exists "anon_select_invoice_status_broadcast" on realtime.messages;

create policy "anon_select_invoice_status_broadcast"
  on realtime.messages
  for select
  to anon, authenticated
  using (
    extension = 'broadcast'
    and (select realtime.topic()) ~ '^invoice:[0-9a-fA-F-]{36}$'
  );
