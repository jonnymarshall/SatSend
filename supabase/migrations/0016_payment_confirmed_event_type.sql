-- v1.4.14 — owner-side activity event for confirming a fiat payment.
--
-- When the owner clicks "Confirm payment received" on a marked_as_paid
-- invoice, the activity feed needs a distinct row from the payer's own
-- "marked_as_paid" entry. Reusing 'marked_as_paid' would collapse two
-- different actors into one row.
--
-- The dispute path (marked_as_paid → pending) reuses the existing
-- 'marked_as_unpaid' event type — semantically identical.

alter type invoice_event_type add value if not exists 'payment_confirmed';
