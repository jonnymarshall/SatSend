import type { Database } from "@/lib/database.types";
import { canPublishInvoice } from "@/lib/invoices/can-publish";

/**
 * v1.5.37 (roadmap v1.4.24): which actions an invoice can take, and why not.
 * The invoice list's row menu, the invoice page's Send menu and its Delete
 * button all read this, so an action is never offered and then refused (or,
 * for Delete on a sent invoice, quietly skipped). Unavailable actions are shown
 * greyed out with the reason on hover.
 *
 * Actions that simply don't apply (Mark as paid on a paid invoice, Unarchive on
 * one that isn't archived) stay hidden, as before.
 */
export type Availability = { ok: true } | { ok: false; reason: string };

export const REASONS = {
  noAddress: "Add a bitcoin address to this draft before sending it.",
  badAddress: "This draft's bitcoin address isn't valid. Edit the draft to fix it.",
  emailAlreadyAttempted: "An email has already been attempted for this invoice; multiple sends are not supported.",
  noClientEmail: "No client email on this invoice, so it can't be sent by email.",
  notDraft: "Only drafts can be deleted. You can archive a sent invoice instead.",
} as const;

type Status = Database["public"]["Enums"]["invoice_status"];
const OK: Availability = { ok: true };

export function sendAvailability(invoice: {
  status: Status;
  btc_address: string | null;
  client_email: string | null;
  email_attempted_at: string | null;
}): { email: Availability; byHand: Availability } {
  // Same rule the server applies when sending (publishFieldError).
  const check = canPublishInvoice({ btc_address: invoice.btc_address });
  if (!check.ok) {
    const reason = check.error === "btc_address_required" ? REASONS.noAddress : REASONS.badAddress;
    return { email: { ok: false, reason }, byHand: { ok: false, reason } };
  }
  const email: Availability = invoice.email_attempted_at
    ? { ok: false, reason: REASONS.emailAlreadyAttempted }
    : !invoice.client_email
      ? { ok: false, reason: REASONS.noClientEmail }
      : OK;
  return { email, byHand: OK };
}

// Mirrors the database's delete guard (block_non_draft_delete).
export function deleteAvailability(invoice: { status: Status }): Availability {
  return invoice.status === "draft" ? OK : { ok: false, reason: REASONS.notDraft };
}
