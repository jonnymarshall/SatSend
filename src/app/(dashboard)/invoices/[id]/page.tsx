import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDates } from "@/components/invoice-dates";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { PaymentWatcherUncontrolled } from "@/app/invoice/[id]/payment-watcher-uncontrolled";
import { InvoiceDetailRealtime } from "./invoice-detail-realtime";
import { CopyButton } from "@/components/copy-button";
import { Card } from "@/components/signal/card";
import { InvoiceActions } from "./invoice-actions";
import { InvoiceActivityCard } from "./invoice-activity-card";
import { BackToInvoices } from "./back-to-invoices";
import type { LineItem } from "@/lib/invoices";
import { toInvoice } from "@/lib/invoice-public";
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

  const items: LineItem[] = toInvoice(invoice).line_items;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const shareLink = `${appUrl}/invoice/${invoice.id}`;

  const sectionLabel = "text-xs font-semibold uppercase tracking-[0.08em] text-(--color-text-secondary)";
  const money = (n: number | string | null) => `$${Number(n).toFixed(2)}`;

  return (
    <div id="invoice-detail" className="mx-auto max-w-3xl space-y-6">
      <InvoiceDetailRealtime invoiceId={invoice.id} />
      {/* Header */}
      <div id="invoice-detail--header" className="space-y-3">
        <BackToInvoices />
        <div id="invoice-detail--title-row" className="flex flex-wrap items-start justify-between gap-3">
          <div id="invoice-detail--title-block" className="min-w-0 space-y-1">
            <h1 id="invoice-detail--heading" className="font-display tracking-heading text-[28px] leading-tight font-bold break-words md:text-[32px]">
              {invoice.invoice_number || "Invoice"}
            </h1>
            {invoice.client_email && (
              <p id="invoice-detail--client-email" className="text-[15px] text-(--color-text-secondary)">{invoice.client_email}</p>
            )}
            <div id="invoice-detail--dates" className="pt-1">
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
      </div>

      {invoice.status === "underpaid" && invoice.amount_received_fiat !== null && (
        <p id="invoice-detail--underpaid-indicator" className="rounded-(--radius-md) bg-(--color-warning-soft) px-4 py-3 text-sm font-medium text-(--color-warning-text)">
          Received {money(invoice.amount_received_fiat)} of {money(invoice.total_fiat)}
        </p>
      )}
      {invoice.overpaid && invoice.amount_received_fiat !== null && (
        <p id="invoice-detail--overpaid-indicator" className="rounded-(--radius-md) bg-(--color-warning-soft) px-4 py-3 text-sm font-medium text-(--color-warning-text)">
          Overpaid by ${(Number(invoice.amount_received_fiat) - Number(invoice.total_fiat)).toFixed(2)}
        </p>
      )}

      {/* YOU / CLIENT */}
      {(invoice.your_name || invoice.client_company || invoice.client_address || invoice.client_tax_id) && (
        <Card id="invoice-detail--parties" className="grid gap-6 text-[15px] sm:grid-cols-2">
          <div id="invoice-detail--from-section" className="space-y-0.5">
            <p className={`${sectionLabel} mb-2`}>From</p>
            {invoice.your_name && <p className="font-semibold">{invoice.your_name}</p>}
            {invoice.your_company && <p className="text-(--color-text-secondary)">{invoice.your_company}</p>}
            {invoice.your_email && <p className="break-words text-(--color-text-secondary)">{invoice.your_email}</p>}
            {invoice.your_address && <p className="text-(--color-text-secondary)">{invoice.your_address}</p>}
            {invoice.your_tax_id && <p className="text-(--color-text-secondary)">Tax ID: {invoice.your_tax_id}</p>}
          </div>
          <div id="invoice-detail--bill-to-section" className="space-y-0.5">
            <p className={`${sectionLabel} mb-2`}>Bill To</p>
            {invoice.client_name && <p className="font-semibold">{invoice.client_name}</p>}
            {invoice.client_company && <p className="text-(--color-text-secondary)">{invoice.client_company}</p>}
            {invoice.client_email && <p className="break-words text-(--color-text-secondary)">{invoice.client_email}</p>}
            {invoice.client_address && <p className="text-(--color-text-secondary)">{invoice.client_address}</p>}
            {invoice.client_tax_id && <p className="text-(--color-text-secondary)">Tax ID: {invoice.client_tax_id}</p>}
          </div>
        </Card>
      )}

      {/* Share link (published invoices only) */}
      {invoice.status !== "draft" && (
        <Card id="invoice-detail--share-section" className="space-y-4">
          <p id="invoice-detail--share-heading" className="font-display tracking-heading text-lg font-semibold">Share with client</p>
          <div id="invoice-detail--share-link" className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className={sectionLabel}>Invoice link</p>
              <CopyButton text={shareLink} />
            </div>
            <code className="block rounded-(--radius-sm) bg-(--color-canvas) border border-(--color-border) px-3 py-2.5 text-sm break-all">{shareLink}</code>
          </div>
          {invoice.access_code ? (
            <div id="invoice-detail--share-access-code" className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className={sectionLabel}>Access code</p>
                <CopyButton text={invoice.access_code} />
              </div>
              <code className="block rounded-(--radius-sm) border border-(--color-border) bg-(--color-canvas) px-3 py-2 font-mono text-lg font-semibold tracking-widest">
                {invoice.access_code}
              </code>
            </div>
          ) : (
            <p className="text-sm text-(--color-text-secondary)">No access code — anyone with the link can view this invoice.</p>
          )}
        </Card>
      )}

      {/* Line items + totals */}
      <Card id="invoice-detail--line-items" className="space-y-3">
        <h2 id="invoice-detail--line-items-heading" className="font-display tracking-heading text-lg font-semibold">Line Items</h2>
        <div id="invoice-detail--line-items-list" className="divide-y divide-(--color-border) border-y border-(--color-border)">
          {items.map((item, i) => (
            <div key={i} className="proxy-id--invoice-detail--line-items-row flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-[15px]">
              <span className="min-w-0 break-words">{item.description}</span>
              <span className="text-(--color-text-secondary) tabular-nums">
                {item.quantity} × ${Number(item.unit_price).toFixed(2)} ={" "}
                <span className="font-semibold text-(--color-ink)">
                  ${(item.quantity * item.unit_price).toFixed(2)}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div id="invoice-detail--totals" className="ml-auto max-w-xs space-y-1.5 pt-1 text-[15px] tabular-nums">
          <div className="flex justify-between text-(--color-text-secondary)">
            <span>Subtotal</span>
            <span>{money(invoice.subtotal_fiat)}</span>
          </div>
          {Number(invoice.tax_percent) > 0 && (
            <div className="flex justify-between text-(--color-text-secondary)">
              <span>Tax ({invoice.tax_percent}%)</span>
              <span>{money(invoice.tax_fiat)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-(--color-border) pt-2 text-lg font-semibold">
            <span>Total</span>
            <span>{money(invoice.total_fiat)} {invoice.currency}</span>
          </div>
        </div>
      </Card>

      {/* Bitcoin address + transaction */}
      {(invoice.btc_address || invoice.btc_txid) && (
        <Card id="invoice-detail--bitcoin" className="space-y-4">
          {invoice.btc_address && (
            <div id="invoice-detail--btc-address" className="space-y-1.5">
              <p className={sectionLabel}>Bitcoin Address</p>
              <code className="block font-mono text-sm break-all">{invoice.btc_address}</code>
            </div>
          )}
          {invoice.btc_txid && (
            <div id="invoice-detail--txid" className="space-y-1.5">
              <p className={sectionLabel}>Transaction ID</p>
              <a
                href={`${getMempoolBaseUrl()}/tx/${invoice.btc_txid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block font-mono text-sm break-all text-(--color-ink) underline decoration-(--color-brand) underline-offset-4"
              >
                {invoice.btc_txid}
              </a>
            </div>
          )}
        </Card>
      )}

      <InvoiceActions invoice={invoice} />

      <InvoiceActivityCard invoiceId={invoice.id} />
    </div>
  );
}
