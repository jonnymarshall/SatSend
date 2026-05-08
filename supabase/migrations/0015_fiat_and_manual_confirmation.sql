-- v1.4.14 — fiat payment flow + manual confirmation + mark-as-unpaid gating.
--
-- Three coordinated changes:
--   1. New `marked_as_paid` invoice status. A client self-reports payment
--      (fiat — bank transfer, Wise, etc.) and the invoice sits in this
--      intermediate state until the owner confirms (→ paid) or disputes
--      (→ pending).
--   2. Two new enums + columns: how was this paid (`payment_method`) and
--      who confirmed it (`payment_confirmation_method`). The latter drives
--      mark-as-unpaid eligibility — only manual confirmations can be
--      reverted safely (see src/lib/invoices/manual-confirmation.ts).
--   3. Distinct `paid_at` timestamp, separate from `updated_at` which gets
--      bumped on any column change.
--
-- Migration 0010 already exists for email_events; this is 0015.

alter type invoice_status add value if not exists 'marked_as_paid';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum ('bitcoin', 'fiat', 'bitcoin_offchain');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_confirmation_method') then
    create type payment_confirmation_method as enum ('onchain', 'manual');
  end if;
end$$;

alter table invoices
  add column if not exists payment_method payment_method,
  add column if not exists payment_confirmation_method payment_confirmation_method,
  add column if not exists paid_at timestamptz;
