-- v1.5.31 (roadmap v1.5.2.14-H) — the SatSend reference.
--
-- Every invoice gets a short public reference, shown as "SatSend reference:
-- SS-7K3QX9AB" on the invoice pages, the PDF and the emails, and used in client
-- links (satsend.me/invoice/ss-7k3qx9ab). The UUID stays the primary key and
-- keeps every foreign key, event table, realtime channel and access cookie as
-- they are; old UUID links keep working.
--
-- The stored value is the bare 8 characters, uppercase Crockford base32 (no I,
-- L, O or U, so it can't be misread as 1 or 0): about 40 bits, a trillion
-- combinations. The "SS-" prefix and the lowercase link form are added by the
-- app.
--
-- The database makes the reference, not the app, so:
--   * every way an invoice is created gets one (new invoice, duplicate), and
--     code that doesn't know about references (the live version while this is
--     applied before the merge) still creates valid invoices;
--   * a value sent in on insert is ignored, so nobody picks their own or copies
--     another invoice's;
--   * it can never change afterwards: it is already in clients' inboxes.
--
-- Additive: one column, filled in for every existing invoice, then required.

alter table public.invoices add column if not exists reference text;

-- Random, not derived from the UUID or a counter: that would leak invoice
-- volume and make references guessable. Each character takes the low 5 bits of
-- one random byte (uniform over the 32-letter alphabet). Retries while the
-- value is taken; the unique index below is the backstop.
create or replace function public.generate_invoice_reference()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea;
  candidate text;
begin
  loop
    bytes := extensions.gen_random_bytes(8);
    candidate := '';
    for i in 0..7 loop
      candidate := candidate || substr(alphabet, (get_byte(bytes, i) & 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.invoices i where i.reference = candidate);
  end loop;
  return candidate;
end;
$$;

revoke all on function public.generate_invoice_reference() from public, anon, authenticated;

-- Fill in every existing invoice. The four user triggers are off for this one
-- step: it must not stamp updated_at (old invoices would look just edited),
-- broadcast a realtime update per row, or trip the paid-invoice guard.
alter table public.invoices disable trigger user;
do $$
declare
  r record;
begin
  for r in select id from public.invoices where reference is null loop
    update public.invoices set reference = public.generate_invoice_reference() where id = r.id;
  end loop;
end;
$$;
alter table public.invoices enable trigger user;

-- A bad or duplicate value fails the whole migration loudly instead.
alter table public.invoices
  add constraint invoices_reference_format check (reference ~ '^[0-9A-HJKMNP-TV-Z]{8}$') not valid;
alter table public.invoices validate constraint invoices_reference_format;
create unique index if not exists invoices_reference_key on public.invoices (reference);
alter table public.invoices alter column reference set not null;
-- A placeholder only, so inserts may leave the column out (and the generated
-- types say so). set_invoice_reference always replaces it before the row is
-- written, and the format check would reject an empty value anyway.
alter table public.invoices alter column reference set default '';

comment on column public.invoices.reference is
  'The SatSend reference: 8 uppercase Crockford base32 characters, shown as SS-XXXXXXXX and used in client links (lowercase). Made by the database on insert, never changed (v1.5.31).';

-- Security definer so the uniqueness check sees every invoice, not only the
-- signed-in sender's own rows (RLS), when a sender creates an invoice.
create or replace function public.set_invoice_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.reference := public.generate_invoice_reference();
  elsif new.reference is distinct from old.reference then
    raise exception 'The SatSend reference of an invoice cannot be changed'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Triggers don't need EXECUTE for the caller; nobody may call this directly.
revoke all on function public.set_invoice_reference() from public, anon, authenticated;

create trigger set_invoice_reference_trigger
  before insert or update of reference on public.invoices
  for each row execute function public.set_invoice_reference();

-- The invoice list reads invoice_email_summary, whose columns were fixed when
-- it was made, so it gets the reference too. CREATE OR REPLACE may only add
-- columns at the end; the definition is otherwise unchanged (security_invoker
-- kept, so RLS still applies to whoever reads it; grants are preserved).
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
    i.reference
   FROM public.invoices i
     LEFT JOIN LATERAL ( SELECT email_events.status,
            email_events.error_message,
            email_events.created_at
           FROM public.email_events
          WHERE email_events.invoice_id = i.id AND email_events.email_type = 'invoice_published'::public.email_type
          ORDER BY email_events.created_at DESC
         LIMIT 1) e ON true;
