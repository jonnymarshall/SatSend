import { addressFormValues } from "@/lib/invoices/address";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "@/components/invoice-form";
import { toInvoice } from "@/lib/invoice-public";
import { dateOnlyToUtc } from "@/lib/date-only";
import { findOwnInvoice } from "@/lib/invoices/own-invoice";
import { senderInvoicePath } from "@/lib/invoices/reference";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // v1.5.38: addressed by SatSend reference; old UUID links redirect.
  const found = await findOwnInvoice(supabase, user!.id, id);
  if (!found) notFound();
  const { invoice, canonical } = found!;
  if (invoice.status !== "draft") redirect(senderInvoicePath(invoice));
  if (!canonical) redirect(senderInvoicePath(invoice, "edit"));

  return (
    <div id="invoice-form-page" className="space-y-6">
      <h1 id="invoice-form-page--heading" className="font-display tracking-heading text-[28px] leading-tight font-bold md:text-[32px]">Edit Invoice</h1>
      <InvoiceForm
        invoiceId={invoice.id}
        sessionEmail={user!.email}
        initialValues={{
          invoice_number: invoice.invoice_number ?? "",
          your_name: invoice.your_name ?? "",
          your_email: invoice.your_email ?? "",
          your_company: invoice.your_company ?? "",
          your_tax_id: invoice.your_tax_id ?? "",
          client_name: invoice.client_name ?? "",
          client_email: invoice.client_email ?? "",
          client_company: invoice.client_company ?? "",
          ...addressFormValues(invoice),
          client_tax_id: invoice.client_tax_id ?? "",
          line_items: toInvoice(invoice).line_items,
          tax_percent: invoice.tax_percent ? String(invoice.tax_percent) : "",
          btc_address: invoice.btc_address ?? "",
          due_date: invoice.due_date ? dateOnlyToUtc(invoice.due_date) : undefined,
          no_due_date: !invoice.due_date,
          access_code: invoice.access_code ?? "",
        }}
      />
    </div>
  );
}
