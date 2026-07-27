// Single source of truth for the four overdue cases:
//   #1 — pending + past due  → cron auto-flips to overdue (no manual button)
//   #2 — pending + future due → no manual button (not yet overdue)
//   #3 — pending + no due date → manual "Mark as overdue" available
//   #4 — overdue + no due date → manual "Mark as pending" available
//
// Used by both the row dropdown and the invoice detail page so visibility
// stays consistent across surfaces.

export interface InvoiceForOverdueActions {
  status: string;
  due_date: string | null;
}

const UNPAID_STATES = new Set(["pending", "payment_detected", "underpaid"]);

export function canMarkAsOverdue(invoice: InvoiceForOverdueActions): boolean {
  if (invoice.due_date) return false;
  return UNPAID_STATES.has(invoice.status);
}

export function canMarkAsPending(invoice: InvoiceForOverdueActions): boolean {
  if (invoice.due_date) return false;
  return invoice.status === "overdue";
}

export interface OverdueFlipInput {
  status: string;
  due_date: string | null;
}

export type OverdueFlipDecision =
  | { shouldFlip: true; newStatus: "overdue" }
  | { shouldFlip: false };

export function decideOverdueFlip(input: OverdueFlipInput, now: Date): OverdueFlipDecision {
  if (input.status !== "pending") return { shouldFlip: false };
  if (!input.due_date) return { shouldFlip: false };
  // due_date is YYYY-MM-DD. Treat the day as ending at 23:59:59.999Z so an
  // invoice due "today" still has the rest of today before it goes overdue.
  const dueAt = new Date(`${input.due_date}T23:59:59.999Z`);
  if (Number.isNaN(dueAt.getTime())) return { shouldFlip: false };
  if (now <= dueAt) return { shouldFlip: false };
  return { shouldFlip: true, newStatus: "overdue" };
}
