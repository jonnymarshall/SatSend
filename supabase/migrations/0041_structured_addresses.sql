-- v1.7 — Structured addresses (roadmap v1.7).
--
-- Each party's address becomes six optional parts: line 1, line 2, city,
-- state/province/region, post code and country (ISO 3166-1 alpha-2 code). All
-- optional (Jonny, 2026-11-26), with no country-specific rules, so any address
-- in the world fits.
--
-- Step 1 of 2 (expand). Additive only: twelve nullable columns, a backfill, and
-- the dashboard view gains the new columns at its end. The old free-text
-- your_address / client_address columns stay for now, because the code running
-- in production when this is applied still reads and writes them. A follow-up
-- migration (after v1.7's code is live) copies across anything written in that
-- gap and drops them.

alter table public.invoices
  add column if not exists your_address_line1 text,
  add column if not exists your_address_line2 text,
  add column if not exists your_address_city text,
  add column if not exists your_address_region text,
  add column if not exists your_address_postcode text,
  add column if not exists your_address_country text,
  add column if not exists client_address_line1 text,
  add column if not exists client_address_line2 text,
  add column if not exists client_address_city text,
  add column if not exists client_address_region text,
  add column if not exists client_address_postcode text,
  add column if not exists client_address_country text;

-- Generous limits (200 per line, 2 letters for the country). NOT VALID then
-- VALIDATE (migration-safety): the backfill below can't break them, but a bad
-- row would fail the whole migration loudly instead of being rewritten.
alter table public.invoices
  add constraint invoices_your_address_lengths check (
    char_length(your_address_line1) <= 200 and char_length(your_address_line2) <= 200
    and char_length(your_address_city) <= 200 and char_length(your_address_region) <= 200
    and char_length(your_address_postcode) <= 200
  ) not valid,
  add constraint invoices_client_address_lengths check (
    char_length(client_address_line1) <= 200 and char_length(client_address_line2) <= 200
    and char_length(client_address_city) <= 200 and char_length(client_address_region) <= 200
    and char_length(client_address_postcode) <= 200
  ) not valid,
  add constraint invoices_your_address_country_code check (your_address_country ~ '^[A-Z]{2}$') not valid,
  add constraint invoices_client_address_country_code check (client_address_country ~ '^[A-Z]{2}$') not valid;

-- Old one-box addresses go into line 1 as they are (production: 16 addresses,
-- all one line, at most 52 characters). Jonny, 2026-11-26: old invoices may
-- display less neatly; no parsing.
update public.invoices
   set your_address_line1 = left(btrim(your_address), 200)
 where your_address_line1 is null and nullif(btrim(your_address), '') is not null;

update public.invoices
   set client_address_line1 = left(btrim(client_address), 200)
 where client_address_line1 is null and nullif(btrim(client_address), '') is not null;

alter table public.invoices validate constraint invoices_your_address_lengths;
alter table public.invoices validate constraint invoices_client_address_lengths;
alter table public.invoices validate constraint invoices_your_address_country_code;
alter table public.invoices validate constraint invoices_client_address_country_code;

-- The dashboard view (last defined in 0039). Columns can only be appended, so
-- the new ones go at the end; everything before is unchanged.
create or replace view public.invoice_email_summary with (security_invoker = on) as
 SELECT i.id,
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
    e.status AS last_publish_email_status,
    e.error_message AS last_publish_email_error,
    e.created_at AS last_publish_email_at,
    i.reference,
    i.your_address_line1,
    i.your_address_line2,
    i.your_address_city,
    i.your_address_region,
    i.your_address_postcode,
    i.your_address_country,
    i.client_address_line1,
    i.client_address_line2,
    i.client_address_city,
    i.client_address_region,
    i.client_address_postcode,
    i.client_address_country
   FROM public.invoices i
     LEFT JOIN LATERAL ( SELECT email_events.status,
            email_events.error_message,
            email_events.created_at
           FROM public.email_events
          WHERE email_events.invoice_id = i.id AND email_events.email_type = 'invoice_published'::public.email_type
          ORDER BY email_events.created_at DESC
         LIMIT 1) e ON true;
