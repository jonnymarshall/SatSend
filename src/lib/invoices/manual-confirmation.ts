// v1.4.14 — gate for the "Mark as unpaid" button.
//
// Reverting a paid invoice is only safe when the original confirmation was
// manual (a human reported "I paid you" and another human confirmed it). If
// the platform itself observed the on-chain transaction, reverting back to
// pending would leave the invoice stuck: future cron sweeps would re-detect
// the same tx and re-confirm. The only safe revert path for an on-chain
// invoice is to also replace the BTC address — deferred from this version.
//
// Legacy invoices paid before v1.4.14 have a null confirmation method and
// are treated as on-chain (every paid invoice before this version went
// through on-chain detection).

export type PaymentConfirmationMethod = "onchain" | "manual" | null;

export interface InvoiceForUnpaidGate {
  status: string;
  // Accept undefined too: callers reading from a partial / projected row
  // (e.g. dashboard table data) may not always include the column. Treat
  // undefined the same as null — neither is a manual confirmation.
  payment_confirmation_method: PaymentConfirmationMethod | undefined;
}

export function canMarkAsUnpaid(invoice: InvoiceForUnpaidGate): boolean {
  if (invoice.status !== "paid") return false;
  return invoice.payment_confirmation_method === "manual";
}
