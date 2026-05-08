import { createAdminClient } from "@/lib/supabase/admin";
import { LineItem } from "@/lib/invoices";

export interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string | null;
  your_name: string | null;
  your_email: string | null;
  your_company: string | null;
  your_address: string | null;
  your_tax_id: string | null;
  client_name: string;
  client_email: string;
  client_company: string | null;
  client_address: string | null;
  client_tax_id: string | null;
  line_items: LineItem[];
  subtotal_fiat: number;
  tax_fiat: number;
  tax_percent: number;
  total_fiat: number;
  currency: string;
  btc_address: string | null;
  btc_txid: string | null;
  status: "draft" | "pending" | "payment_detected" | "paid" | "overdue" | "archived";
  access_code: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
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

  return data as Invoice;
}
