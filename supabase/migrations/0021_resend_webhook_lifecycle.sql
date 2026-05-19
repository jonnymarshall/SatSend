-- v1.4.18 — Resend webhook: sent vs delivered vs bounced.
--
-- Today email_events.status only captures send-time outcomes (queued, sent,
-- failed, skipped_no_api_key). Resend delivers post-acceptance lifecycle
-- events (delivery confirmed by recipient mailbox, hard bounce, recipient
-- marked as spam) via a Svix-signed webhook. This migration adds the three
-- new statuses and the dedupe table the webhook uses for exactly-once
-- processing.

-- 1. Extend the email_event_status enum.
--    `if not exists` makes the migration safe to re-run.
alter type email_event_status add value if not exists 'delivered';
alter type email_event_status add value if not exists 'bounced';
alter type email_event_status add value if not exists 'complained';

-- 2. Dedicated index on resend_message_id. The webhook handler looks up
--    email_events rows by this column on every event; without an index it
--    would full-scan the table.
create index if not exists email_events_resend_message_id_idx
  on email_events (resend_message_id)
  where resend_message_id is not null;

-- 3. Webhook delivery dedupe table.
--    Resend (via Svix) retries failed deliveries with the same svix-id.
--    Inserting the id with `on conflict do nothing` and checking the row
--    count gives us at-most-once processing as a DB-enforced invariant,
--    independent of whatever status logic runs next.
create table webhook_deliveries (
  svix_id      text primary key,
  event_type   text not null,
  received_at  timestamptz not null default now()
);

-- No RLS: server-role-only writes, no anon reads. The table is not
-- user-scoped (a webhook event references an email_event_id internally, not
-- a user id at the protocol layer), so RLS would add no security value.
