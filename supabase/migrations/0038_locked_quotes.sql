-- v1.5.29 (roadmap v1.5.2.22-H) — locked quotes and a tighter Slippage Tolerance.
--
-- Until now the client was shown a bitcoin amount worked out at page load, and
-- the payment was valued at the price when it CONFIRMED, often 20 to 60 minutes
-- later. Price movement in between is why a payment counted as paid in full
-- within 5% either way. Now:
--
--   * Clicking "Pay now in Bitcoin" records a quote: the bitcoin amount shown,
--     the price behind it and when it expires (30 minutes). A payment that
--     matches a quote is judged in bitcoin against it, so price movement drops
--     out, and valued at the quoted price.
--   * With no matching quote (paid late, or from the PDF), the payment is valued
--     at the price when it was first seen (btc_price_at_seen), not at confirmation.
--   * The Slippage Tolerance used for the verdict is recorded on the invoice, so
--     invoices judged under the old 5% keep reading correctly.
--
-- Additive only: one new table, three nullable columns, one function.

create table public.invoice_quotes (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount_sats bigint not null check (amount_sats > 0),
  btc_price numeric not null check (btc_price > 0),
  total_fiat numeric not null,
  currency text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);

create index invoice_quotes_invoice_time on public.invoice_quotes (invoice_id, created_at desc);

-- RLS on with no policies: no app role can read or write quotes; only the server
-- (service_role) and the function below touch them.
alter table public.invoice_quotes enable row level security;
revoke all on table public.invoice_quotes from public, anon, authenticated;

alter table public.invoices
  add column if not exists btc_price_at_seen numeric,
  add column if not exists slippage_tolerance_fiat numeric,
  add column if not exists payment_quote_id uuid references public.invoice_quotes (id) on delete set null;

create index if not exists invoices_payment_quote_id on public.invoices (payment_quote_id);

comment on column public.invoices.btc_price_at_seen is
  'BTC price when the payment was first seen. Values a payment that matches no quote (v1.5.29).';
comment on column public.invoices.slippage_tolerance_fiat is
  'The Slippage Tolerance (in the invoice currency) the payment was judged with. Null for invoices judged before v1.5.29 (5% either way).';
comment on column public.invoices.payment_quote_id is
  'The quote the payment was judged against, if it matched one (v1.5.29).';
comment on column public.invoices.btc_price_at_detection is
  'BTC price used to value amount_received_sats: the quoted price, else the price when first seen, else at confirmation (v1.5.29).';

-- Hands out a quote for an invoice, in one locked step per invoice:
--   * a quote made in the last p_reuse_seconds and still valid is returned as
--     is, so reloads and double clicks can't fill the table (at most about one
--     new row per invoice per p_reuse_seconds, whoever asks);
--   * this invoice's quotes that expired more than p_keep_seconds ago and judged
--     no payment are deleted.
-- The server works out the amount and price; this function only stores them.
create or replace function public.take_invoice_quote(
  p_invoice_id uuid,
  p_amount_sats bigint,
  p_btc_price numeric,
  p_total_fiat numeric,
  p_currency text,
  p_valid_seconds integer,
  p_reuse_seconds integer,
  p_keep_seconds integer
)
returns setof public.invoice_quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.invoice_quotes;
begin
  perform pg_advisory_xact_lock(hashtextextended('invoice_quote:' || p_invoice_id::text, 0));

  select * into existing
    from public.invoice_quotes q
   where q.invoice_id = p_invoice_id
     and q.created_at > now() - make_interval(secs => p_reuse_seconds)
     and q.expires_at > now()
   order by q.created_at desc
   limit 1;

  if found then
    return next existing;
    return;
  end if;

  delete from public.invoice_quotes q
   where q.invoice_id = p_invoice_id
     and q.expires_at < now() - make_interval(secs => p_keep_seconds)
     and not exists (select 1 from public.invoices i where i.payment_quote_id = q.id);

  return query
    insert into public.invoice_quotes (invoice_id, amount_sats, btc_price, total_fiat, currency, expires_at)
    values (p_invoice_id, p_amount_sats, p_btc_price, p_total_fiat, p_currency, now() + make_interval(secs => p_valid_seconds))
    returning *;
end;
$$;

-- Server only. Revoking from public is not enough on Supabase: default
-- privileges re-grant EXECUTE to anon and authenticated, so revoke those too.
revoke all on function public.take_invoice_quote(uuid, bigint, numeric, numeric, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.take_invoice_quote(uuid, bigint, numeric, numeric, text, integer, integer, integer)
  to service_role;
