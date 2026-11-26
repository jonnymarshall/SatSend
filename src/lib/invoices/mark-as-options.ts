import { canMarkAsOverdue, canMarkAsPending, type InvoiceForOverdueActions } from "./overdue-actions";

/**
 * Which "Mark as …" choices an invoice offers (the rules from the old Mark as
 * menu, v1.4.11 and v1.5.27; moved here in v1.5.41 when the invoice page put
 * them in its More menu). Each choice names the action it runs:
 * "paid" → markPaid, "unpaid" → markUnpaid (back to pending), "overdue" →
 * markOverdue.
 */
export type MarkAsOption = { action: "paid" | "unpaid" | "overdue"; label: "paid" | "unpaid" | "pending" | "overdue" };

const UNPAID_STATES = new Set(["pending", "payment_detected", "underpaid"]);

export function markAsOptions({
  status,
  dueDate,
  paidOnChain = false,
}: {
  status: InvoiceForOverdueActions["status"];
  dueDate: string | null;
  // v1.5.27: a payment confirmed on the blockchain can't be undone by marking
  // the invoice unpaid; the next check finds the bitcoin again.
  paidOnChain?: boolean;
}): MarkAsOption[] {
  if (status === "draft" || status === "archived") return [];
  const isPaid = status === "paid";
  const options: MarkAsOption[] = [];
  if (!isPaid) options.push({ action: "paid", label: "paid" });
  // "Pending" is the case-#4 reverse (overdue → pending); paid → pending stays
  // available unless the payment is on the blockchain. Not offered when the
  // invoice is already unpaid.
  const showPending = (isPaid && !paidOnChain) || canMarkAsPending({ status, due_date: dueDate });
  if (showPending && !UNPAID_STATES.has(status)) options.push({ action: "unpaid", label: isPaid ? "unpaid" : "pending" });
  if (canMarkAsOverdue({ status, due_date: dueDate })) options.push({ action: "overdue", label: "overdue" });
  return options;
}
