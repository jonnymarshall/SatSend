-- Fixes a bug in 0022/0023: broadcast_invoice_status_change() sets
-- `search_path = ''` (correct hardening — prevents search_path injection
-- attacks against a security definer function), but referenced the
-- `invoice_broadcast_record` composite type unqualified. With an empty
-- search path Postgres can't resolve it, so every non-draft UPDATE to
-- `invoices` was throwing `type "invoice_broadcast_record" does not exist`
-- (42704) and aborting the whole transaction — not just breaking the
-- realtime broadcast, but silently blocking every invoice update since 0022
-- was applied (mark-as-paid, edits, cron sweeps, everything). The type
-- itself was created fine (CREATE TYPE with an unqualified name resolves
-- against the *creating* session's search_path, which included `public`);
-- only the *reference* to it from inside this specific search_path='' function
-- needed qualifying.

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
    row(new.id, new.status, new.btc_txid)::public.invoice_broadcast_record,
    row(old.id, old.status, old.btc_txid)::public.invoice_broadcast_record
  );
  return null;
end;
$$;
