import { addressFormValues, type AddressKey } from "./address";
import type { LineItem } from "@/lib/invoices";
import { dateOnlyToUtc } from "@/lib/date-only";

/**
 * v1.5.34 (roadmap v1.4.25): duplicating an invoice opens the New Invoice form
 * filled in from the original (/invoices/new?from=<id>). Nothing is saved until
 * the sender saves, so cancelling leaves no stray draft.
 */

// v1.4.16: cap matches the DB CHECK constraint (migration 0020) and the form's
// maxLength.
const INVOICE_NUMBER_MAX_LENGTH = 30;

// v1.4.23-H: pick a genuinely unique number. The old version appended a fixed
// "... (copy)", so duplicating an invoice that was already a copy produced the
// same string again and manufactured duplicate numbers (a live prod bug). Walk
// " (copy)", " (copy 2)", ... until one is not already taken, trimming the source
// to fit the 30-char cap. Returns null when source is null/empty so duplicates of
// unnumbered invoices stay unnumbered.
export function buildDuplicateInvoiceNumber(
  source: string | null | undefined,
  taken: Set<string>,
): string | null {
  if (!source) return null;
  for (let n = 1; n <= 999; n++) {
    const suffix = n === 1 ? " (copy)" : ` (copy ${n})`;
    const room = INVOICE_NUMBER_MAX_LENGTH - suffix.length;
    const base = source.length > room ? source.slice(0, room) : source;
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}

interface DuplicateSource extends Partial<Record<AddressKey, string | null>> {
  invoice_number: string | null;
  your_name: string | null;
  your_email: string | null;
  your_company: string | null;
  your_tax_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_company: string | null;
  client_tax_id: string | null;
  line_items: unknown;
  tax_percent: number | null;
  due_date: string | null;
  access_code: string | null;
}

/**
 * What the New Invoice form starts with for a copy. Same fields the old
 * duplicate action copied: everything but the receiving address (each invoice
 * needs a fresh one), the payment record and the status (a copy starts as a new
 * invoice). Same shape the edit page passes.
 */
export function duplicateFormValues(source: DuplicateSource, taken: Set<string>) {
  return {
    invoice_number: buildDuplicateInvoiceNumber(source.invoice_number, taken) ?? "",
    your_name: source.your_name ?? "",
    your_email: source.your_email ?? "",
    your_company: source.your_company ?? "",
    your_tax_id: source.your_tax_id ?? "",
    client_name: source.client_name ?? "",
    client_email: source.client_email ?? "",
    client_company: source.client_company ?? "",
    ...addressFormValues(source),
    client_tax_id: source.client_tax_id ?? "",
    line_items: (source.line_items ?? []) as LineItem[],
    tax_percent: source.tax_percent ? String(source.tax_percent) : "",
    btc_address: "",
    due_date: source.due_date ? dateOnlyToUtc(source.due_date) : undefined,
    no_due_date: !source.due_date,
    access_code: source.access_code ?? "",
  };
}
