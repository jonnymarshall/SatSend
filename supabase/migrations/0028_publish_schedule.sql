-- v1.4.28-H (S3): a publish timestamp for time-based payment scheduling.
--
-- The per-invoice polling schedule used to advance by "attempt count": each cron
-- tick incremented stage_attempt and read the next interval off a fixed table.
-- That assumed a frequent tick. Under a sparse tick (Vercel Hobby caps cron at
-- once a day) a fresh invoice burned through its whole schedule within a week
-- and then stopped being watched, even though nothing was wrong with it.
--
-- The schedule is now derived from wall-clock time, which needs a fixed anchor:
-- the moment the invoice went live. `created_at` cannot serve as that anchor --
-- it is the draft-creation time, so a draft left unpublished for days would
-- start life already past every delay boundary. `published_at` is set at publish.
--
-- Existing published (non-draft) rows are back-filled with created_at, the best
-- available approximation of when they went live.

alter table public.invoices
  add column if not exists published_at timestamptz;

update public.invoices
  set published_at = created_at
  where published_at is null
    and status <> 'draft';
