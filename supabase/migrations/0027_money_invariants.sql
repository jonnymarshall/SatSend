-- v1.4.21-H (S4) — the database defends money state.
--
-- Until now the database would accept impossible money: a negative total, a tax
-- percent outside 0-100, a currency that is not USD, a total that does not equal
-- sub-total plus tax, malformed line items, an edit to the money fields of an
-- invoice that is already paid, or the deletion of a real (non-draft) invoice.
-- This migration makes the database itself refuse those, so a bug or a stray
-- request cannot cause them.
--
-- The CHECK constraints are added NOT VALID first (so they apply to new writes
-- immediately) and then VALIDATEd at the end. If any existing row breaks a rule,
-- the final VALIDATE fails and the whole migration stops — nothing is silently
-- deleted or rewritten. Fix the reported rows and re-run.

-- 1. Money shape.

alter table invoices add constraint amounts_non_negative
  check (subtotal_fiat >= 0 and tax_fiat >= 0 and total_fiat >= 0) not valid;

alter table invoices add constraint tax_percent_range
  check (tax_percent >= 0 and tax_percent <= 100) not valid;

-- Only USD for now; widen when multi-currency (v2.6) lands.
alter table invoices add constraint currency_whitelist
  check (currency = 'USD') not valid;

alter table invoices add constraint totals_consistent
  check (total_fiat = round(subtotal_fiat + tax_fiat, 2)) not valid;

-- 2. line_items must be an array of objects, each with a numeric quantity and
-- unit price. `is distinct from` so a missing key counts as a failure.
create or replace function line_items_valid(items jsonb)
returns boolean
language sql
immutable
as $$
  select items is not null
    and jsonb_typeof(items) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(items) as e
      where jsonb_typeof(e) is distinct from 'object'
        or jsonb_typeof(e -> 'quantity') is distinct from 'number'
        or jsonb_typeof(e -> 'unit_price') is distinct from 'number'
    );
$$;

alter table invoices add constraint line_items_shape
  check (line_items_valid(line_items)) not valid;

-- 3. A paid (or mid-payment) invoice's money and payment fields are frozen. Only
-- those columns are protected; status, the amount received, the next check time
-- and the txid must still be writable, because the detection flow updates them
-- after the invoice is paid.
create or replace function protect_paid_invoice_fields()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('paid', 'payment_detected') then
    if new.subtotal_fiat is distinct from old.subtotal_fiat
      or new.tax_fiat is distinct from old.tax_fiat
      or new.tax_percent is distinct from old.tax_percent
      or new.total_fiat is distinct from old.total_fiat
      or new.currency is distinct from old.currency
      or new.line_items is distinct from old.line_items
      or new.btc_address is distinct from old.btc_address
    then
      raise exception 'cannot change money or payment fields on a % invoice', old.status
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_paid_invoice_fields_trigger on invoices;
create trigger protect_paid_invoice_fields_trigger
before update on invoices
for each row
execute function protect_paid_invoice_fields();

-- 4. Only drafts may be deleted, so the financial audit trail (email_events,
-- invoice_events, which cascade) cannot be destroyed for a real invoice.
create or replace function block_non_draft_delete()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'draft' then
    raise exception 'only draft invoices may be deleted (this one is %)', old.status
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists block_non_draft_delete_trigger on invoices;
create trigger block_non_draft_delete_trigger
before delete on invoices
for each row
execute function block_non_draft_delete();

-- 5. Switch the constraints on fully. Fails loudly (and rolls the whole migration
-- back) if any existing row breaks a rule.
alter table invoices validate constraint amounts_non_negative;
alter table invoices validate constraint tax_percent_range;
alter table invoices validate constraint currency_whitelist;
alter table invoices validate constraint totals_consistent;
alter table invoices validate constraint line_items_shape;
