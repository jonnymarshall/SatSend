import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "@/components/invoice-form";
import { toInvoice } from "@/lib/invoice-public";

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
    <div id="invoice-form-page" className="space-y-6">
      <h1 id="invoice-form-page--heading" className="font-display tracking-heading text-[28px] leading-tight font-bold md:text-[32px]">Edit Invoice</h1>
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
          line_items: toInvoice(invoice).line_items,
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
