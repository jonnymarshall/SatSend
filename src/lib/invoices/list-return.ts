/*
 * R-63 (release 1.6.1): where "← Invoices" goes. The invoice list remembers its
 * own address (with ?page=N) each time it's shown; the back link opens that, or
 * /invoices. It used to be the browser's back, which after saving a draft is the
 * edit form. Kept per tab (sessionStorage); a blocked store just means /invoices.
 */

const KEY = "satsend:invoice-list-url";
const LIST = "/invoices";

function isListUrl(url: string): boolean {
  return url === LIST || url.startsWith(`${LIST}?`);
}

export function rememberInvoiceListUrl(url: string): void {
  if (!isListUrl(url)) return;
  try {
    window.sessionStorage.setItem(KEY, url);
  } catch {
    // storage blocked: the back link falls back to /invoices
  }
}

export function invoiceListUrl(): string {
  try {
    const url = window.sessionStorage.getItem(KEY);
    if (url && isListUrl(url)) return url;
  } catch {
    // storage blocked
  }
  return LIST;
}
