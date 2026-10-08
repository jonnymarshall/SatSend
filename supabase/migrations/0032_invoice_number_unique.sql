-- v1.4.23.1-H — invoice-number uniqueness (split from v1.4.23-H).
--
-- Production had 8 duplicate (user_id, invoice_number) groups, all from the
-- pre-v1.4.23-H duplicate-number generator bug (see
-- development/invoice-number-duplicates-audit.md). The unique index below needs
-- them gone first.
--
-- We RENAME the later copies rather than delete them: the 0027
-- block_non_draft_delete trigger refuses to delete non-draft invoices (and 6 of
-- the 8 groups involve one), and a rename is reversible and preserves the audit
-- trail. The statement is generic and idempotent: it works on any database, and
-- re-running it finds nothing left to rename.
--
-- The suffix is capped so the result stays within the 30-char limit (0020):
-- left(..., 20) + " (dup N)" is at most 29 chars.
with ranked as (
  select id,
         row_number() over (
           partition by user_id, invoice_number
           order by created_at, id
         ) as rn,
         invoice_number
    from public.invoices
   where invoice_number is not null
     and invoice_number <> ''
)
update public.invoices i
   set invoice_number = left(r.invoice_number, 20) || ' (dup ' || r.rn || ')'
  from ranked r
 where i.id = r.id
   and r.rn > 1;

-- Uniqueness among non-blank numbers. Drafts may have a blank number (several
-- blank drafts are fine), so the index is partial on non-blank values.
create unique index invoices_user_id_invoice_number_idx
  on public.invoices (user_id, invoice_number)
  where invoice_number is not null
    and invoice_number <> '';
