import { createAdminClient } from "@/lib/supabase/admin";
import { LineItem } from "@/lib/invoices";
import type { Database } from "@/lib/database.types";

type InvoicesRow = Database["public"]["Tables"]["invoices"]["Row"];

// One home for the invoice row shape the app uses (v1.4.27-H). Derived from the
// generated types, with the one JSONB column (line_items) narrowed from Json to
// LineItem[]; its shape is enforced by the line_items_shape CHECK (migration 0027).
export type Invoice = Omit<InvoicesRow, "line_items"> & { line_items: LineItem[] };

// The invoice_email_summary view row = a full invoice plus the last publish
// email fields. The generated view row is all-nullable (a Postgres view wart
// where NOT NULL is not propagated), so we build it from Invoice, whose columns
// come straight from the invoices table.
export type InvoiceSummaryRow = Invoice & {
  last_publish_email_status: Database["public"]["Enums"]["email_event_status"] | null;
  last_publish_email_error: string | null;
  last_publish_email_at: string | null;
};

// The single JSONB read cast. Use at the database boundary.
export function toInvoice(row: InvoicesRow): Invoice {
  return { ...row, line_items: (row.line_items ?? []) as unknown as LineItem[] };
}

export async function fetchPublicInvoice(id: string): Promise<Invoice | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  if (data.status === "draft") return null;

  return toInvoice(data);
}

// The shape allowed to cross into the client component tree. access_code is
// the page's own auth secret and user_id identifies the owner — neither
// should ever reach the payer's browser.
export type PublicInvoice = Omit<Invoice, "access_code" | "user_id">;

export function toPublicInvoice(invoice: Invoice): PublicInvoice {
  const { access_code: _access_code, user_id: _user_id, ...publicInvoice } = invoice;
  return publicInvoice;
}
