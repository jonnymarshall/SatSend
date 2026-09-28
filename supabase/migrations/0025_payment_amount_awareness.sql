-- v1.4.19-H (S2): payment amount verification. Detection today flips an
-- invoice to `paid` the moment it sees any confirmed tx at the address, with
-- no check on the amount received. This adds an `underpaid` status plus
-- columns to persist what was actually received and the price used to judge
-- it, so a partial payment is distinguishable from a full one and an
-- overpayment is flagged rather than silently absorbed.
--
-- Coverage is judged in fiat, priced at the moment the payment is confirmed —
-- not a price snapshotted at invoice-publish time, which would drift against
-- the invoice's actual fiat total as BTC moves between publish and payment.

alter type invoice_status add value if not exists 'underpaid';

alter table invoices add column if not exists amount_received_sats bigint;
alter table invoices add column if not exists btc_price_at_detection numeric;
alter table invoices add column if not exists amount_received_fiat numeric;
alter table invoices add column if not exists overpaid boolean not null default false;

comment on column invoices.amount_received_sats is 'Sats actually received at the invoice btc_address, summed from the paying tx''s matching vouts. Populated once the payment is confirmed to the required depth.';
comment on column invoices.btc_price_at_detection is 'BTC/currency price used to convert amount_received_sats to fiat, fetched at confirmation time (not publish time).';
comment on column invoices.amount_received_fiat is 'amount_received_sats converted to fiat using btc_price_at_detection.';
comment on column invoices.overpaid is 'True when amount_received_fiat exceeds total_fiat beyond the tolerance band. Invoice status stays paid; this is a flag alongside it.';
