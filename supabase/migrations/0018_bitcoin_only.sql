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

-- 1. Defensive audit. If any non-draft rows lack a btc_address, abort the
--    migration so we can reconcile manually rather than silently failing
--    the constraint add. v1.4.12 made btc_address required at publish, so
--    this is expected to be zero on production — but the check is cheap
--    and the failure mode of skipping it is much worse than a clear
--    "reconcile first" abort.
do $$
declare
  offenders int;
begin
  select count(*) into offenders
    from invoices
   where status != 'draft' and btc_address is null;
  if offenders > 0 then
    raise exception 'Migration 0018 aborted: % invoice(s) have status != draft and btc_address is null. Reconcile manually before re-running.', offenders;
  end if;
end$$;

-- 2. Add the publish-time CHECK constraint.
alter table invoices add constraint btc_address_required_when_published
  check (status = 'draft' or btc_address is not null);

-- 3. Drop the accepts_bitcoin column.
alter table invoices drop column accepts_bitcoin;
