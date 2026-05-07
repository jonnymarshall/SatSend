"use client";

import { useCallback, useState } from "react";
import { Invoice } from "@/lib/invoice-public";
import { fiatToBtc, buildBip21Uri } from "@/lib/btc-qr";
import { BtcQrCode } from "@/components/btc-qr-code";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { InvoiceDates } from "@/components/invoice-dates";
import { PaymentWatcher } from "./payment-watcher";
import { MarkSentButton } from "./mark-sent-button";
import { PayFiatButton } from "./pay-fiat-button";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { getMempoolBaseUrl } from "@/lib/btc-network";
import { usePublicInvoiceRealtime } from "./use-public-invoice-realtime";

function isPayableStatus(s: Invoice["status"]): boolean {
  return s === "pending" || s === "overdue";
}

interface Props {
  invoice: Invoice;
  btcPrice: number | null;
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}


export function InvoicePaymentView({ invoice, btcPrice }: Props) {
  const [status, setStatus] = useState<Invoice["status"]>(invoice.status);
  // v1.4.13: hold txid in client state so detection (from the watcher OR the
  // realtime UPDATE) renders the mempool link without a manual refresh.
  const [btcTxid, setBtcTxid] = useState<string | null>(invoice.btc_txid);
  const [userRevealedPayment, setUserRevealedPayment] = useState(false);

  const handleWatcherStatusChange = useCallback(
    (s: Invoice["status"], txid?: string) => {
      setStatus(s);
      if (txid) setBtcTxid(txid);
    },
    [],
  );

  // Realtime fallback for cron-driven status changes the on-page mempool watcher
  // can't observe. The watcher remains the fastest path when the payer is here.
  const handleRealtimeUpdate = useCallback(
    (next: { status?: Invoice["status"]; btc_txid?: string | null }) => {
      if (next.status) setStatus(next.status);
      if (next.btc_txid) setBtcTxid(next.btc_txid);
    },
    [],
  );
  usePublicInvoiceRealtime(invoice.id, handleRealtimeUpdate);

  // Auto-reveal payment details for invoices that aren't awaiting payment (already
  // detected/paid), so the txid link is visible without an extra click.
  const showPaymentDetails = userRevealedPayment || !isPayableStatus(status);
  const cur = invoice.currency;
  const showBtc = invoice.accepts_bitcoin && !!invoice.btc_address && !!btcPrice;
  const btcAmount = showBtc ? fiatToBtc(invoice.total_fiat, btcPrice!) : null;
  const btcAmountDisplay = btcAmount !== null
    ? btcAmount.toFixed(8).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
    : null;
  const bip21Uri = showBtc
    ? buildBip21Uri(
        invoice.btc_address!,
        btcAmount!,
        invoice.invoice_number ?? undefined
      )
    : null;

  const senderHasInfo = invoice.your_name || invoice.your_company || invoice.your_address || invoice.your_email || invoice.your_tax_id;
  const clientHasInfo = invoice.client_name || invoice.client_company || invoice.client_address || invoice.client_email || invoice.client_tax_id;

  return (
    <main id="invoice-view--main" className="min-h-screen p-6">
      <div id="invoice-view--container" className="mx-auto max-w-3xl space-y-8">

        {/* Header */}
        <div id="invoice-view--header" className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 id="invoice-view--title" className="text-2xl font-semibold">
              {invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : "Invoice"}
            </h1>
            <InvoiceDates createdAt={invoice.created_at} dueDate={invoice.due_date} />
          </div>
          <div className="flex items-start gap-3">
            <a
              id="invoice-view--download-pdf"
              href={`/api/invoice/${invoice.id}/pdf`}
              download
            >
              <Button variant="outline" size="sm">Download PDF</Button>
            </a>
            {invoice.accepts_bitcoin && invoice.btc_address ? (
              <PaymentWatcher
                invoiceId={invoice.id}
                btcAddress={invoice.btc_address}
                status={status}
                onStatusChange={handleWatcherStatusChange}
                paymentRevealed={showPaymentDetails}
              />
            ) : (
              <InvoiceStatusBadge status={status} id="invoice-view--status" />
            )}
          </div>
        </div>

        {/* Parties */}
        {(senderHasInfo || clientHasInfo) && (
          <div id="invoice-view--parties" className="grid grid-cols-2 gap-8 rounded-lg border border-border p-6">
            {senderHasInfo && (
              <div id="invoice-view--sender" className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">From</p>
                {invoice.your_name && <p id="invoice-view--sender-name" className="text-sm font-medium">{invoice.your_name}</p>}
                {invoice.your_company && <p id="invoice-view--sender-company" className="text-sm text-muted-foreground">{invoice.your_company}</p>}
                {invoice.your_email && <p id="invoice-view--sender-email" className="text-sm text-muted-foreground">{invoice.your_email}</p>}
                {invoice.your_address && <p id="invoice-view--sender-address" className="text-sm text-muted-foreground whitespace-pre-line">{invoice.your_address}</p>}
                {invoice.your_tax_id && <p id="invoice-view--sender-tax-id" className="text-sm text-muted-foreground">Tax ID: {invoice.your_tax_id}</p>}
              </div>
            )}
            {clientHasInfo && (
              <div id="invoice-view--client" className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">To</p>
                {invoice.client_name && <p id="invoice-view--client-name" className="text-sm font-medium">{invoice.client_name}</p>}
                {invoice.client_company && <p id="invoice-view--client-company" className="text-sm text-muted-foreground">{invoice.client_company}</p>}
                {invoice.client_email && <p id="invoice-view--client-email" className="text-sm text-muted-foreground">{invoice.client_email}</p>}
                {invoice.client_address && <p id="invoice-view--client-address" className="text-sm text-muted-foreground whitespace-pre-line">{invoice.client_address}</p>}
                {invoice.client_tax_id && <p id="invoice-view--client-tax-id" className="text-sm text-muted-foreground">Tax ID: {invoice.client_tax_id}</p>}
              </div>
            )}
          </div>
        )}

        {/* Line items */}
        <div id="invoice-view--line-items" className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th id="invoice-view--col-description" className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                <th id="invoice-view--col-qty" className="px-4 py-3 text-right font-medium text-muted-foreground w-20">Qty</th>
                <th id="invoice-view--col-unit-price" className="px-4 py-3 text-right font-medium text-muted-foreground w-32">Unit price</th>
                <th id="invoice-view--col-total" className="px-4 py-3 text-right font-medium text-muted-foreground w-32">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item, i) => (
                <tr key={i} id={`invoice-view--line-item-${i}`} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{item.description || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtCurrency(item.unit_price, cur)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtCurrency(item.quantity * item.unit_price, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div id="invoice-view--totals" className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span id="invoice-view--subtotal" className="tabular-nums">{fmtCurrency(invoice.subtotal_fiat, cur)}</span>
            </div>
            {invoice.tax_percent > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({invoice.tax_percent}%)</span>
                <span id="invoice-view--tax" className="tabular-nums">{fmtCurrency(invoice.tax_fiat, cur)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <span>Total</span>
              <span id="invoice-view--total" className="tabular-nums">{fmtCurrency(invoice.total_fiat, cur)}</span>
            </div>
          </div>
        </div>

        {/* BTC payment */}
        {showBtc && (
          <div id="invoice-view--btc-section" className="rounded-lg border border-border p-6 space-y-6">
            <h2 id="invoice-view--btc-heading" className="font-semibold">Pay with Bitcoin</h2>
            {showPaymentDetails ? (
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <BtcQrCode uri={bip21Uri!} size={200} />
                <div className="space-y-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">BTC amount</p>
                    <div className="flex items-center gap-3">
                      <p id="invoice-view--btc-amount" className="text-lg font-semibold tabular-nums">
                        {btcAmountDisplay} BTC
                      </p>
                      <CopyButton text={btcAmountDisplay!} label="Copy BTC amount" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      at {fmtCurrency(btcPrice!, "USD")}/BTC
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</p>
                    <div className="flex items-start gap-3">
                      <p id="invoice-view--btc-address" className="text-xs font-mono break-all">{invoice.btc_address}</p>
                      <CopyButton text={invoice.btc_address!} label="Copy BTC address" />
                    </div>
                  </div>
                  {btcTxid && (
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Transaction ID</p>
                      <a
                        id="invoice-view--btc-txid"
                        href={`${getMempoolBaseUrl()}/tx/${btcTxid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono break-all text-blue-500 hover:underline"
                      >
                        {btcTxid}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Button
                id="invoice-view--reveal-btc-button"
                className="w-full"
                onClick={() => setUserRevealedPayment(true)}
              >
                Pay now in Bitcoin
              </Button>
            )}
            <MarkSentButton
              invoiceId={invoice.id}
              btcAddress={invoice.btc_address!}
              status={status}
              onStatusChange={setStatus}
              showButton={showPaymentDetails}
            />
          </div>
        )}

        {/* Fiat payment — v1.4.14. Visible whenever the invoice is payable.
           Always shown, since every invoice has a fiat total. */}
        {isPayableStatus(status) && (
          <div id="invoice-view--fiat-section" className="rounded-lg border border-border p-6 space-y-4">
            <h2 id="invoice-view--fiat-heading" className="font-semibold">Pay with {invoice.currency}</h2>
            <p className="text-sm text-muted-foreground">
              Already paid by bank transfer, Wise, or another off-chain method?
              Mark this invoice as paid and the seller will confirm receipt.
            </p>
            <PayFiatButton
              invoiceId={invoice.id}
              currency={invoice.currency}
              onMarked={() => setStatus("marked_as_paid")}
            />
          </div>
        )}

        {invoice.accepts_bitcoin && !invoice.btc_address && (
          <p id="invoice-view--btc-missing" className="text-sm text-muted-foreground text-center">
            Bitcoin payment details not yet configured for this invoice.
          </p>
        )}

        {invoice.accepts_bitcoin && invoice.btc_address && !btcPrice && (
          <div id="invoice-view--btc-price-error" className="rounded-lg border border-border p-6 space-y-2">
            <h2 className="font-semibold">Pay with Bitcoin</h2>
            <p className="text-sm text-muted-foreground">
              Bitcoin address: <span className="font-mono text-xs">{invoice.btc_address}</span>
            </p>
            <p className="text-xs text-muted-foreground">BTC price unavailable — please calculate the amount manually.</p>
            {btcTxid && (
              <p className="text-xs text-muted-foreground">
                Transaction:{" "}
                <a
                  id="invoice-view--btc-txid-fallback"
                  href={`${getMempoolBaseUrl()}/tx/${btcTxid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-500 hover:underline"
                >
                  {btcTxid}
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
