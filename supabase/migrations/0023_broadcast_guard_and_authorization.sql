-- Follow-up to 0022_close_anon_exposures.sql, applied as its own migration
-- because 0022 was already pushed to remote before these two gaps were found
-- (both statements are written defensively so this file is also safe to run
-- against a from-scratch database where the edited 0022 already created
-- them):
--
-- 1. realtime.broadcast_changes() sends via realtime.send(), which defaults
--    `private = true` — an anon subscriber only receives the message if
--    realtime.messages RLS grants it. Without this policy the payer page's
--    broadcast subscription silently receives nothing.
-- 2. The trigger must not broadcast draft invoices (they aren't shared with
--    anyone yet) — added as a guard inside the trigger function.

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

drop policy if exists "anon_select_invoice_status_broadcast" on realtime.messages;

create policy "anon_select_invoice_status_broadcast"
  on realtime.messages
  for select
  to anon
  using (
    extension = 'broadcast'
    and topic ~ '^invoice:[0-9a-fA-F-]{36}$'
  );
