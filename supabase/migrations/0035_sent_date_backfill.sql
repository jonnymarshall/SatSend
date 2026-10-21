-- v1.5.19 (roadmap v1.5.2.0.1-H) — an invoice is a draft or it's sent.
--
-- "Publish only" is gone: every way to send an invoice now makes it live and
-- records its sent date (sent_at) in the same write. Invoices published before
-- this without being sent (or marked as sent) are given their publish day as
-- their sent date, so every live invoice has one (Jonny, 2026-10-21).
--
-- published_at stays the payment-check timer's anchor and is never shown: it is
-- reset when a detected payment vanishes or an archived invoice is restored.
-- Drafts can't be archived, so "not a draft" is exactly "went live".
update public.invoices
   set sent_at = coalesce(published_at, created_at),
       send_method = 'manual'
 where status <> 'draft'
   and sent_at is null;
