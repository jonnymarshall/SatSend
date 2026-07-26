-- v1.4.20-H (S1) — Close the four anon database exposures.
--
-- 2026-07 master architecture audit findings CRIT-1, CRIT-2, CRIT-3:
--
--   CRIT-1: invoice_email_summary is a plain view (`select i.*` from invoices),
--           which by default runs with the view owner's privileges, not the
--           caller's — so it bypasses the RLS on the underlying `invoices`
--           table entirely and hands the anon key every invoice (draft or not,
--           including access_code and user_id).
--   CRIT-2: webhook_deliveries has no RLS at all — any anon request can read
--           the whole dedupe table.
--   CRIT-3: the `anon_select_non_draft` policy (migration 0009) lets anon read
--           every non-draft invoice's full row via postgres_changes. The payer
--           page only needs to know when `status`/`btc_txid` change, not read
--           the row directly, so this policy is replaced with a narrow,
--           trigger-driven broadcast instead of a table-level grant.

-- 1. CRIT-1 — force the view to run with the caller's (anon's) privileges, so
--    it is subject to the same RLS as querying `invoices` directly, and strip
--    the anon grant so it can't be queried by the public key at all (owners
--    already query invoices directly, not through this view).
alter view invoice_email_summary set (security_invoker = on);
revoke all on invoice_email_summary from anon;

-- 2. CRIT-2 — lock the webhook dedupe table down completely. No policies are
--    added: the webhook handler writes via the service-role client, which
--    bypasses RLS, and nothing in the product reads this table on behalf of a
--    user. Enabling RLS with zero policies means even `authenticated` gets
--    nothing back from PostgREST.
alter table webhook_deliveries enable row level security;

-- 3. CRIT-3 — drop the blanket anon SELECT policy on invoices.
drop policy "anon_select_non_draft" on invoices;

-- 4. Replace the postgres_changes path the payer page relied on with a
--    trigger-driven broadcast carrying only the two fields the payer view
--    actually consumes (status, btc_txid). A dedicated composite type keeps
--    this true regardless of how realtime.broadcast_changes() serializes its
--    `new`/`old` arguments internally — the record we hand it only ever has
--    these three columns, so nothing else (access_code, client PII, amounts)
--    can leak through the broadcast. Drafts are never broadcast at all, so
--    there is no need to re-derive "is this invoice public?" inside the
--    realtime.messages policy below (which can't query `invoices` anymore —
--    anon has no SELECT policy on it as of step 3 above).
create type invoice_broadcast_record as (
  id uuid,
  status text,
  btc_txid text
);

create or replace function broadcast_invoice_status_change()
returns trigger
security definer
set search_path = ''
language plpgsql
as $$
begin
  if new.status = 'draft' then
    return null;
  end if;

  perform realtime.broadcast_changes(
    'invoice:' || new.id::text,
    'UPDATE',
    'UPDATE',
    'invoices',
    'public',
    row(new.id, new.status, new.btc_txid)::invoice_broadcast_record,
    row(old.id, old.status, old.btc_txid)::invoice_broadcast_record
  );
  return null;
end;
$$;

create trigger broadcast_invoice_status_change_trigger
after update on invoices
for each row
execute function broadcast_invoice_status_change();

-- realtime.broadcast_changes() sends via realtime.send(), which defaults
-- `private = true` — an unauthenticated (anon) subscriber only receives the
-- message if realtime.messages RLS grants it, and only if the client opens
-- the channel with `{ config: { private: true } }`. Scope the grant to the
-- topic naming pattern this trigger uses, rather than joining back to
-- `invoices` (anon can no longer read that table, and DRAFT invoices are
-- already excluded at the source by the trigger's guard above).
create policy "anon_select_invoice_status_broadcast"
  on realtime.messages
  for select
  to anon
  using (
    extension = 'broadcast'
    and topic ~ '^invoice:[0-9a-fA-F-]{36}$'
  );

-- 5. Shrink the realtime blast radius. REPLICA IDENTITY FULL (migration 0006)
--    was only needed so UPDATE payloads carried full rows for postgres_changes
--    consumers; confirmed via grep that no code reads `payload.old`, so DEFAULT
--    is safe. (Restricting *which* operations the publication emits per-table
--    is not possible in Postgres — `publish` is a publication-wide setting, not
--    a per-table one, despite an earlier draft of this migration assuming
--    otherwise; dropping the anon SELECT policy above already fully blocks
--    anon from postgres_changes regardless of publication config, so no
--    publication change is needed to close the exposure.)
alter table public.invoices replica identity default;
