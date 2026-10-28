-- v1.5.27 (roadmap v1.5.2.13-H): when a payment confirmed.
--
-- The payer's invoice page shows "Paid on <date and time>". mempool_seen_at is
-- when SatSend first spotted the payment, not when it confirmed, so the
-- confirmation time gets its own column, filled from the block's own time by
-- the payment check. Null for unpaid invoices, for invoices paid before this
-- column existed, and for invoices marked as paid by hand.
--
-- Additive and nullable: no existing row changes. invoice_email_summary lists
-- its columns (0029), so it doesn't depend on this one.

alter table public.invoices
  add column if not exists payment_confirmed_at timestamptz;

comment on column public.invoices.payment_confirmed_at is
  'When the paying transaction confirmed (its block time). Set with a paid or underpaid verdict; cleared when an invoice is marked unpaid.';
