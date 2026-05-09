import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDates } from "@/components/invoice-dates";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { PaymentWatcherUncontrolled } from "@/app/invoice/[id]/payment-watcher-uncontrolled";
import { InvoiceDetailRealtime } from "./invoice-detail-realtime";
import { CopyButton } from "@/components/copy-button";
import { InvoiceActions } from "./invoice-actions";
import { InvoiceActivityCard } from "./invoice-activity-card";
import { BackToInvoices } from "./back-to-invoices";
import type { LineItem } from "@/lib/invoices";
import { getMempoolBaseUrl } from "@/lib/btc-network";

export default async function InvoiceDetailPage({
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

  const items: LineItem[] = invoice.line_items ?? [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const shareLink = `${appUrl}/invoice/${invoice.id}`;

  return (
    <div id="invoice-detail" className="max-w-2xl mx-auto space-y-8">
      <InvoiceDetailRealtime invoiceId={invoice.id} />
      {/* Header */}
      <div id="invoice-detail--header" className="flex items-start justify-between">
        <div>
          <BackToInvoices />
          <div className="mt-2">
            <h1 id="invoice-detail--heading" className="text-2xl font-semibold">{invoice.invoice_number || "Invoice"}</h1>
          </div>
          {invoice.client_email && (
            <p className="text-sm text-muted-foreground">{invoice.client_email}</p>
          )}
          <div className="mt-2">
            <InvoiceDates createdAt={invoice.created_at} dueDate={invoice.due_date} />
          </div>
        </div>
        {invoice.btc_address &&
        (invoice.status === "pending" ||
          invoice.status === "payment_detected" ||
          invoice.status === "overdue") ? (
          <PaymentWatcherUncontrolled
            key={invoice.status}
            invoiceId={invoice.id}
            btcAddress={invoice.btc_address}
            initialStatus={invoice.status}
          />
        ) : (
          <InvoiceStatusBadge status={invoice.status} />
        )}
      </div>

      {/* YOU / CLIENT */}
      {(invoice.your_name || invoice.client_company || invoice.client_address || invoice.client_tax_id) && (
        <div id="invoice-detail--parties" className="grid grid-cols-2 gap-6 text-sm">
          <div id="invoice-detail--from-section" className="space-y-0.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">From</p>
            {invoice.your_name && <p className="font-medium">{invoice.your_name}</p>}
            {invoice.your_company && <p className="text-muted-foreground">{invoice.your_company}</p>}
            {invoice.your_email && <p className="text-muted-foreground">{invoice.your_email}</p>}
            {invoice.your_address && <p className="text-muted-foreground">{invoice.your_address}</p>}
            {invoice.your_tax_id && <p className="text-muted-foreground">Tax ID: {invoice.your_tax_id}</p>}
          </div>
          <div id="invoice-detail--bill-to-section" className="space-y-0.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Bill To</p>
            {invoice.client_name && <p className="font-medium">{invoice.client_name}</p>}
            {invoice.client_company && <p className="text-muted-foreground">{invoice.client_company}</p>}
            {invoice.client_email && <p className="text-muted-foreground">{invoice.client_email}</p>}
            {invoice.client_address && <p className="text-muted-foreground">{invoice.client_address}</p>}
            {invoice.client_tax_id && <p className="text-muted-foreground">Tax ID: {invoice.client_tax_id}</p>}
          </div>
        </div>
      )}

      {/* Share link (published invoices only) */}
      {invoice.status !== "draft" && (
        <div id="invoice-detail--share-section" className="rounded-lg border border-border bg-card px-5 py-4 space-y-4">
          <p className="text-sm font-medium">Share with client</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Invoice link</p>
              <CopyButton text={shareLink} />
            </div>
            <code className="block text-xs bg-muted rounded px-3 py-2 break-all">{shareLink}</code>
          </div>
          {invoice.access_code ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Access code</p>
                <CopyButton text={invoice.access_code} />
              </div>
              <code className="block text-lg font-mono font-semibold tracking-widest px-3 py-2 bg-muted rounded">
                {invoice.access_code}
              </code>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No access code — anyone with the link can view this invoice.</p>
          )}
        </div>
      )}

      {/* Line items */}
      <section id="invoice-detail--line-items" className="space-y-3">
        <h2 id="invoice-detail--line-items-heading" className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Line Items</h2>
        <div id="invoice-detail--line-items-list" className="rounded-lg border border-border divide-y divide-border">
          {items.map((item, i) => (
            <div key={i} className="proxy-id--invoice-detail--line-items-row flex items-center justify-between px-4 py-3 text-sm">
              <span>{item.description}</span>
              <span className="text-muted-foreground">
                {item.quantity} × ${Number(item.unit_price).toFixed(2)} ={" "}
                <span className="text-foreground font-medium">
                  ${(item.quantity * item.unit_price).toFixed(2)}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Bitcoin address */}
      {invoice.btc_address && (
        <div className="rounded-lg border border-border bg-card px-5 py-4 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Bitcoin Address</p>
          <code className="block text-xs break-all">{invoice.btc_address}</code>
        </div>
      )}

      {/* Transaction ID */}
      {invoice.btc_txid && (
        <div className="rounded-lg border border-border bg-card px-5 py-4 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Transaction ID</p>
          <a
            href={`${getMempoolBaseUrl()}/tx/${invoice.btc_txid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs font-mono break-all text-blue-500 hover:underline"
          >
            {invoice.btc_txid}
          </a>
        </div>
      )}

      {/* Totals */}
      <div id="invoice-detail--totals" className="rounded-lg border border-border bg-card px-5 py-4 space-y-1.5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>${Number(invoice.subtotal_fiat).toFixed(2)}</span>
        </div>
        {Number(invoice.tax_percent) > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Tax ({invoice.tax_percent}%)</span>
            <span>${Number(invoice.tax_fiat).toFixed(2)}</span>
          </div>
        )}
<div className="flex justify-between font-semibold text-base pt-1 border-t border-border">
          <span>Total</span>
          <span>${Number(invoice.total_fiat).toFixed(2)} {invoice.currency}</span>
        </div>
      </div>

      <InvoiceActions invoice={invoice} />

      <InvoiceActivityCard invoiceId={invoice.id} />
    </div>
  );
}
