import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "@/components/invoice-form";
import type { LineItem } from "@/lib/invoices";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!invoice) notFound();
  if (invoice.status !== "draft") redirect(`/invoices/${id}`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit Invoice</h1>
      <InvoiceForm
        invoiceId={id}
        sessionEmail={user!.email}
        initialValues={{
          invoice_number: invoice.invoice_number ?? "",
          your_name: invoice.your_name ?? "",
          your_email: invoice.your_email ?? "",
          your_company: invoice.your_company ?? "",
          your_address: invoice.your_address ?? "",
          your_tax_id: invoice.your_tax_id ?? "",
          client_name: invoice.client_name ?? "",
          client_email: invoice.client_email ?? "",
          client_company: invoice.client_company ?? "",
          client_address: invoice.client_address ?? "",
          client_tax_id: invoice.client_tax_id ?? "",
          line_items: (invoice.line_items as LineItem[]) ?? [{ description: "", quantity: 1, unit_price: 0 }],
          tax_percent: invoice.tax_percent ? String(invoice.tax_percent) : "",
          btc_address: invoice.btc_address ?? "",
          due_date: invoice.due_date ? new Date(invoice.due_date) : undefined,
          no_due_date: !invoice.due_date,
          access_code: invoice.access_code ?? "",
        }}
      />
    </div>
  );
}
