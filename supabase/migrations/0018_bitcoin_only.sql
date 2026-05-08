-- v1.4.14 — bitcoin-only focus.
--
-- Two coordinated changes:
--   1. Drop `accepts_bitcoin` from the invoices table. Bitcoin is no longer
--      optional; every invoice accepts BTC. The flag has no semantic role
--      after the slice 1-6 code changes.
--   2. Enforce that every non-draft invoice has a btc_address. Drafts may
--      still be saved without one (the form's "save draft" path explicitly
--      allows this), but publishing requires one — already enforced at the
--      action layer in slice 2; this migration adds a DB-level guard so the
--      invariant survives any future code path.

-- 1. Reconcile any non-draft invoices that lack a btc_address. These can
--    only exist on databases that predate v1.4.12 (which added the
--    publish-time btc_address requirement at the action layer); on a
--    fresh install, or any DB that has been through v1.4.12, the count
--    is zero and this block is a no-op.
--
--    The original draft of this migration ABORTED on non-zero offenders
--    to force manual review. We hit that abort once during the v1.4.14
--    deploy with 24 offenders, inspected them all (abandoned test rows
--    with empty client_name and trivial totals — see v1.4.14.1), and
--    decided the right ergonomics is to delete inline so the migration
--    is self-healing rather than fragile against legacy data. The
--    constraint added in step 2 is what guarantees no future row enters
--    this state.
--
--    Cascading FKs on email_events and invoice_events handle related
--    rows automatically.
do $$
declare
  offenders int;
begin
  select count(*) into offenders
    from invoices
   where status != 'draft' and btc_address is null;
  if offenders > 0 then
    raise notice 'Migration 0018: deleting % invoice(s) with status != draft and btc_address is null', offenders;
    delete from invoices where status != 'draft' and btc_address is null;
  end if;
end$$;

-- 2. Add the publish-time CHECK constraint.
alter table invoices add constraint btc_address_required_when_published
  check (status = 'draft' or btc_address is not null);

-- 3. Drop the accepts_bitcoin column.
alter table invoices drop column accepts_bitcoin;
