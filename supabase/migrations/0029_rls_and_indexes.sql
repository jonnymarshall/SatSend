-- v1.4.23-H — RLS & indexes: correctness and hygiene pass.
--
-- Findings addressed: M-DB-4 (pre_archive_status unconstrained text), M-DB-5
-- (invoice_email_summary uses `select i.*`), M-DB-6 (missing invoices.user_id
-- index + unwrapped auth.uid()), and email_events.updated_at owned by the
-- application instead of the database.
--
-- Deliberately NOT here: the (user_id, invoice_number) unique index. Production
-- already has duplicate groups (see the v1.4.23-H PR description and the split-out
-- roadmap item); adding the constraint now would fail the migration. The app-side
-- generator bug that creates those duplicates IS fixed in the same PR.
--
-- Everything below is non-concurrent so the whole migration runs in one
-- transaction (Supabase wraps each migration). That guarantees the dropped RLS
-- policies can never be left missing if a later statement fails.

-- ---------------------------------------------------------------------------
-- 0. Drop the summary view first. Postgres refuses to alter a column's type
--    while a view depends on that column ("cannot alter type of a column used
--    by a view or rule"), and pre_archive_status is one of the view's columns.
--    It is recreated in section 2 with enumerated columns.
-- ---------------------------------------------------------------------------
drop view if exists public.invoice_email_summary;

-- ---------------------------------------------------------------------------
-- 1. M-DB-4 — pre_archive_status: text -> invoice_status enum.
--    Clean any legacy value that is not a real status first (earlier eras wrote
--    values like 'marked_as_paid'); those rows fall back to NULL, which
--    bulkUnarchive now reports rather than guessing at.
-- ---------------------------------------------------------------------------
update public.invoices
   set pre_archive_status = null
 where pre_archive_status is not null
   and pre_archive_status not in
       ('draft','pending','payment_detected','paid','overdue','archived','underpaid');

alter table public.invoices
  alter column pre_archive_status type invoice_status
  using pre_archive_status::invoice_status;

-- The enum constrains the values; this additionally forbids the two statuses a
-- row can never have been archived from (bulkArchive excludes drafts and
-- already-archived rows).
alter table public.invoices
  drop constraint if exists invoices_pre_archive_status_valid;
alter table public.invoices
  add constraint invoices_pre_archive_status_valid
  check (pre_archive_status is null or pre_archive_status not in ('draft','archived'));

-- ---------------------------------------------------------------------------
-- 2. M-DB-5 — recreate the summary view with its columns enumerated instead of
--    `select i.*`. With the star, the view depends on every base column, so
--    dropping any column the view does not even expose fails (0017/0018 already
--    hit this). Then re-assert the security posture from 0022: without
--    security_invoker the view runs as its owner, bypasses the invoices RLS, and
--    reopens CRIT-1; without the anon revoke, anon can read every invoice.
-- ---------------------------------------------------------------------------
create view public.invoice_email_summary as
select
  i.id,
  i.user_id,
  i.client_name,
  i.client_email,
  i.line_items,
  i.subtotal_fiat,
  i.tax_fiat,
  i.total_fiat,
  i.currency,
  i.btc_address,
  i.status,
  i.access_code,
  i.due_date,
  i.created_at,
  i.updated_at,
  i.invoice_number,
  i.tax_percent,
  i.your_name,
  i.your_email,
  i.your_company,
  i.your_address,
  i.your_tax_id,
  i.client_company,
  i.client_address,
  i.client_tax_id,
  i.btc_txid,
  i.pre_archive_status,
  i.next_check_at,
  i.mempool_seen_at,
  i.stage_attempt,
  i.sent_at,
  i.send_method,
  i.email_attempted_at,
  i.amount_received_sats,
  i.btc_price_at_detection,
  i.amount_received_fiat,
  i.overpaid,
  i.published_at,
  e.status        as last_publish_email_status,
  e.error_message as last_publish_email_error,
  e.created_at    as last_publish_email_at
from public.invoices i
left join lateral (
  select status, error_message, created_at
    from public.email_events
   where invoice_id = i.id
     and email_type = 'invoice_published'
   order by created_at desc
   limit 1
) e on true;

alter view public.invoice_email_summary set (security_invoker = on);
revoke all on public.invoice_email_summary from anon;
grant select on public.invoice_email_summary to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. M-DB-6 — index the hot filter and wrap auth.uid() so it is evaluated once
--    per query instead of once per row.
-- ---------------------------------------------------------------------------
create index if not exists invoices_user_id_created_at_idx
  on public.invoices (user_id, created_at desc);

drop policy if exists "owner_all" on public.invoices;
create policy "owner_all" on public.invoices
  for all
  to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "owner can read own invoice events" on public.invoice_events;
create policy "owner can read own invoice events" on public.invoice_events
  for select
  to public
  using ((select auth.uid()) = user_id);

drop policy if exists "owner can read own email events" on public.email_events;
create policy "owner can read own email events" on public.email_events
  for select
  to public
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 4. email_events.updated_at owned by the DB, not the application. The webhook
--    route no longer writes it (v1.4.23-H / M-DB-7).
-- ---------------------------------------------------------------------------
create or replace function public.set_email_events_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists email_events_set_updated_at on public.email_events;
create trigger email_events_set_updated_at
  before update on public.email_events
  for each row
  execute function public.set_email_events_updated_at();
