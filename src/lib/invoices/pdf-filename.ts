export interface PdfFilenameInput {
  id: string;
  invoice_number: string | null;
  your_company: string | null;
  your_name: string | null;
  your_email: string | null;
  created_at: string;
  published_at?: string | null;
  sent_at?: string | null;
  account_email?: string | null;
}

function sanitise(value: string): string {
  return value
    .replace(/[/\\]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function emailPrefix(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  const prefix = email.split("@")[0];
  return prefix.trim() ? sanitise(prefix) : null;
}

function pickSender(input: PdfFilenameInput): string {
  const candidates = [input.your_company, input.your_name];
  for (const c of candidates) {
    if (c && c.trim()) return sanitise(c);
  }
  return emailPrefix(input.your_email) ?? emailPrefix(input.account_email) ?? "invoice";
}

function pickInvoiceName(input: PdfFilenameInput): string {
  if (input.invoice_number && input.invoice_number.trim()) {
    return sanitise(input.invoice_number);
  }
  return `…${input.id.slice(-8)}`;
}

function pickDate(input: PdfFilenameInput): string {
  // v1.5.19: the invoice date is the day it was sent.
  const iso = input.sent_at ?? input.published_at ?? input.created_at;
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export function buildPdfFilename(input: PdfFilenameInput): string {
  return `${pickSender(input)}_${pickInvoiceName(input)}_${pickDate(input)}.pdf`;
}
