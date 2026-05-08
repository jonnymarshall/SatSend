-- v1.4.14 — revert the fiat-payment / manual-confirmation work from
-- migrations 0015 and 0016.
--
-- Context: 0015 and 0016 were applied to the remote DB as part of the
-- abandoned fiat-payment branch (preserved on
-- origin/v1.4.14/fiat-payment-and-manual-confirmation). Product pivoted
-- to bitcoin-only on 2026-05-07; the schema additions are no longer
-- needed and need to come out before the bitcoin-only migration lands.
--
-- No shipped code writes to these columns or emits the new enum values,
-- so any rows referencing them should not exist on production. The
-- pre-clean steps below are defensive: if for some reason such rows
-- exist (e.g. dev-environment manual testing), we move them to safe
-- prior-state values rather than letting the cast fail.

-- 0. Drop dependents that reference invoices.status. They get recreated
--    at the end of the migration with identical bodies. This pattern is
--    necessary because Postgres blocks `alter column type` whenever a
--    view, rule, or policy references the column — and the rename-recreate
--    pattern for the enum (step 4) needs the column type swap.
--
--    The `anon_select_non_draft` policy (migration 0009), the
--    `invoice_email_summary` view (migration 0012), and the
--    `invoices_btc_address_active_idx` partial unique index (migration
--    0001, with `where status != 'draft'`) all depend on invoices.status.
drop view if exists invoice_email_summary;
drop policy if exists "anon_select_non_draft" on invoices;
drop index if exists invoices_btc_address_active_idx;

-- 1. Drop the columns added by 0015 (depend on custom types we drop next).
alter table invoices
  drop column if exists payment_method,
  drop column if exists payment_confirmation_method,
  drop column if exists paid_at;

-- 2. Drop the custom types added by 0015.
drop type if exists payment_method;
drop type if exists payment_confirmation_method;

-- 3. Pre-clean any rows still referencing 'marked_as_paid' (defensive;
--    expected to be zero on production).
update invoices set status = 'pending' where status = 'marked_as_paid';

-- 4. Recreate `invoice_status` enum without 'marked_as_paid'.
--    Postgres has no DROP VALUE for enums; the rename-recreate-cast
--    pattern is the only safe way.
alter type invoice_status rename to invoice_status_old;

create type invoice_status as enum (
  'draft',
  'pending',
  'payment_detected',
  'paid',
  'overdue',
  'archived'
);

alter table invoices
  alter column status drop default,
  alter column status type invoice_status using status::text::invoice_status,
  alter column status set default 'draft';

drop type invoice_status_old;

-- 5. Pre-clean any invoice_events still referencing 'payment_confirmed'
--    (defensive; expected to be zero on production).
delete from invoice_events where event_type = 'payment_confirmed';

-- 6. Recreate `invoice_event_type` enum without 'payment_confirmed'.
alter type invoice_event_type rename to invoice_event_type_old;

create type invoice_event_type as enum (
  'marked_as_sent',
  'marked_as_paid',
  'marked_as_overdue',
  'marked_as_unpaid'
);

alter table invoice_events
  alter column event_type type invoice_event_type using event_type::text::invoice_event_type;

drop type invoice_event_type_old;

-- 7. Recreate the dependents dropped in step 0 with their original bodies.
--    Mirrors migration 0001 (invoices_btc_address_active_idx), migration
--    0009 (anon_select_non_draft policy), and migration 0012
--    (invoice_email_summary view) verbatim.
create unique index invoices_btc_address_active_idx
  on invoices (btc_address)
  where status != 'draft' and btc_address is not null;

create policy "anon_select_non_draft" on invoices
  for select
  to anon
  using (status != 'draft');

create or replace view invoice_email_summary as
select
  i.*,
  e.status        as last_publish_email_status,
  e.error_message as last_publish_email_error,
  e.created_at    as last_publish_email_at
from invoices i
left join lateral (
  select status, error_message, created_at
    from email_events
   where invoice_id = i.id
     and email_type = 'invoice_published'
   order by created_at desc
   limit 1
) e on true;
