/**
 * The SatSend reference (v1.5.31, roadmap v1.5.2.14-H): a short public
 * identifier for an invoice, separate from the sender's own invoice number.
 *
 * The database makes it (migration 0039) and stores the bare 8 characters,
 * uppercase Crockford base32. People see it as "SS-7K3QX9AB" (capitals read
 * aloud and copy by hand more easily); links use "ss-7k3qx9ab" to match the
 * site's lowercase addresses. Anything typed or pasted is read leniently.
 * The UUID stays the primary key, and old UUID links keep working.
 */

/** The one label, used verbatim on every surface (Jonny, 2026-11-24). */
export const REFERENCE_LABEL = "SatSend reference";

const PREFIX = "SS-";
const REFERENCE = /^[0-9A-HJKMNP-TV-Z]{8}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** "7K3QX9AB" → "SS-7K3QX9AB", for the invoice pages, PDF and emails. */
export function formatReference(reference: string): string {
  return `${PREFIX}${reference.toUpperCase()}`;
}

/** "7K3QX9AB" → "ss-7k3qx9ab", for links. */
export function referencePath(reference: string): string {
  return formatReference(reference).toLowerCase();
}

/** The client's link path for an invoice: "/invoice/ss-7k3qx9ab". */
export function publicInvoicePath(invoice: { reference: string }): string {
  return `/invoice/${referencePath(invoice.reference)}`;
}

/**
 * The sender's own page for an invoice (v1.5.38): "/invoices/ss-7k3qx9ab", or
 * its edit page. One invoice, one name in every link.
 */
export function senderInvoicePath(invoice: { reference: string }, page?: "edit"): string {
  return `/invoices/${referencePath(invoice.reference)}${page ? `/${page}` : ""}`;
}

export type InvoiceKey = { kind: "reference"; reference: string } | { kind: "id"; id: string };

/**
 * What a public invoice link points at: a reference (with or without "SS-", in
 * any case, with Crockford's look-alikes I and L read as 1 and O as 0) or an
 * old UUID. Null for anything else, so nonsense never reaches the database.
 */
export function parseInvoiceKey(input: string): InvoiceKey | null {
  const raw = input.trim();
  if (UUID.test(raw.toLowerCase())) return { kind: "id", id: raw.toLowerCase() };

  const upper = raw.toUpperCase();
  // The prefixed form is 10 or 11 characters, a bare one 8, so a bare
  // reference that happens to start with "SS" is never mistaken for one.
  const prefixed = /^SS-?(.{8})$/.exec(upper);
  const bare = prefixed ? prefixed[1] : upper;
  const reference = bare.replace(/[IL]/g, "1").replace(/O/g, "0");
  return REFERENCE.test(reference) ? { kind: "reference", reference } : null;
}
