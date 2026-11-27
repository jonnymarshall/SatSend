-- R-52 (release 1.6.2): drop the old one-box address columns.
--
-- Step 2 of 2 after 0041, which added the structured columns and copied the
-- old text into line 1. Since release 1.5.40 no code reads or writes
-- your_address / client_address, so this is safe to apply before the merge.
--
-- 1. Safety net: copy any old text still missing from line 1 (none on
--    2026-11-26, in test or production).
-- 2. Rebuild invoice_email_summary without the two columns. A view's columns
--    can't be removed with CREATE OR REPLACE, so drop and recreate it, exactly
--    as 0041 defined it minus those two, then restore its grants. Supabase's
--    default privileges hand a new view to anon, which never had it: revoke.
-- 3. Drop the columns.

update public.invoices
   set your_address_line1 = left(btrim(your_address), 200)
 where your_address_line1 is null and nullif(btrim(your_address), '') is not null;

update public.invoices
   set client_address_line1 = left(btrim(client_address), 200)
 where client_address_line1 is null and nullif(btrim(client_address), '') is not null;

drop view public.invoice_email_summary;

create view public.invoice_email_summary with (security_invoker = on) as
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
    i.your_tax_id,
    i.client_company,
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

revoke all on public.invoice_email_summary from public, anon;
grant all on public.invoice_email_summary to authenticated, service_role;

alter table public.invoices drop column your_address;
alter table public.invoices drop column client_address;
