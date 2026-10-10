"use client";

import { useCallback, useState } from "react";
import type { PublicInvoice } from "@/lib/invoice-public";
import { fiatToBtc, buildBip21Uri } from "@/lib/btc-qr";
import { BtcQrCode } from "@/components/btc-qr-code";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { InvoiceDates } from "@/components/invoice-dates";
import { PaymentWatcher } from "./payment-watcher";
import { MarkSentButton } from "./mark-sent-button";
import { Button, buttonVariants } from "@/components/signal/button";
import { Card } from "@/components/signal/card";
import { SatSendLogo } from "@/components/brand/satsend-logo";
import { CopyButton } from "@/components/copy-button";
import { getMempoolBaseUrl } from "@/lib/btc-network";
import { usePublicInvoiceRealtime } from "./use-public-invoice-realtime";

function isPayableStatus(s: PublicInvoice["status"]): boolean {
  return s === "pending" || s === "overdue";
}

interface Props {
  invoice: PublicInvoice;
  btcPrice: number | null;
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}


export function InvoicePaymentView({ invoice, btcPrice }: Props) {
  const [status, setStatus] = useState<PublicInvoice["status"]>(invoice.status);
  // v1.4.13: hold txid in client state so detection (from the watcher OR the
  // realtime UPDATE) renders the mempool link without a manual refresh.
  const [btcTxid, setBtcTxid] = useState<string | null>(invoice.btc_txid);
  const [userRevealedPayment, setUserRevealedPayment] = useState(false);

  const handleWatcherStatusChange = useCallback(
    (s: PublicInvoice["status"], txid?: string) => {
      setStatus(s);
      if (txid) setBtcTxid(txid);
    },
    [],
  );

  // Realtime fallback for cron-driven status changes the on-page mempool watcher
  // can't observe. The watcher remains the fastest path when the payer is here.
  const handleRealtimeUpdate = useCallback(
    (next: { status?: PublicInvoice["status"]; btc_txid?: string | null }) => {
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
  const showBtc = !!invoice.btc_address && !!btcPrice;
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

  const label = "text-xs font-semibold uppercase tracking-[0.08em] text-(--color-text-secondary)";
  const txLink = "font-mono break-all text-(--color-ink) underline decoration-(--color-brand) underline-offset-4";

  return (
    <main id="invoice-view--main" className="min-h-dvh flex-1 px-4 py-6 sm:px-6 sm:py-10">
      <div id="invoice-view--container" className="mx-auto max-w-3xl space-y-6">
        <SatSendLogo id="invoice-view--logo" style={{ width: 116 }} />

        {/* Header */}
        <Card id="invoice-view--header" className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div id="invoice-view--title-block" className="min-w-0 space-y-2">
            <h1 id="invoice-view--title" className="font-display tracking-heading text-[26px] leading-tight font-bold break-words sm:text-[30px]">
              {invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : "Invoice"}
            </h1>
            <InvoiceDates createdAt={invoice.created_at} dueDate={invoice.due_date} />
          </div>
          <div id="invoice-view--header-actions" className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end">
            {invoice.btc_address ? (
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
            <a
              id="invoice-view--download-pdf"
              href={`/api/invoice/${invoice.id}/pdf`}
              download
              className={buttonVariants({ variant: "secondary", size: "sm", className: "h-11 sm:h-9" })}
            >
              Download PDF
            </a>
          </div>
        </Card>

        {/* Parties */}
        {(senderHasInfo || clientHasInfo) && (
          <Card id="invoice-view--parties" className="grid gap-6 sm:grid-cols-2 sm:gap-8">
            {senderHasInfo && (
              <div id="invoice-view--sender" className="space-y-1 text-[15px]">
                <p className={`${label} mb-2`}>From</p>
                {invoice.your_name && <p id="invoice-view--sender-name" className="font-semibold">{invoice.your_name}</p>}
                {invoice.your_company && <p id="invoice-view--sender-company" className="text-(--color-text-secondary)">{invoice.your_company}</p>}
                {invoice.your_email && <p id="invoice-view--sender-email" className="break-words text-(--color-text-secondary)">{invoice.your_email}</p>}
                {invoice.your_address && <p id="invoice-view--sender-address" className="whitespace-pre-line text-(--color-text-secondary)">{invoice.your_address}</p>}
                {invoice.your_tax_id && <p id="invoice-view--sender-tax-id" className="text-(--color-text-secondary)">Tax ID: {invoice.your_tax_id}</p>}
              </div>
            )}
            {clientHasInfo && (
              <div id="invoice-view--client" className="space-y-1 text-[15px]">
                <p className={`${label} mb-2`}>To</p>
                {invoice.client_name && <p id="invoice-view--client-name" className="font-semibold">{invoice.client_name}</p>}
                {invoice.client_company && <p id="invoice-view--client-company" className="text-(--color-text-secondary)">{invoice.client_company}</p>}
                {invoice.client_email && <p id="invoice-view--client-email" className="break-words text-(--color-text-secondary)">{invoice.client_email}</p>}
                {invoice.client_address && <p id="invoice-view--client-address" className="whitespace-pre-line text-(--color-text-secondary)">{invoice.client_address}</p>}
                {invoice.client_tax_id && <p id="invoice-view--client-tax-id" className="text-(--color-text-secondary)">Tax ID: {invoice.client_tax_id}</p>}
              </div>
            )}
          </Card>
        )}

        {/* Line items + totals */}
        <Card id="invoice-view--line-items" className="overflow-hidden p-0 md:p-0">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-canvas)">
                <th id="invoice-view--col-description" className="px-4 py-3 text-left text-[13px] font-medium text-(--color-text-secondary) sm:px-6">Description</th>
                <th id="invoice-view--col-qty" className="hidden w-20 px-4 py-3 text-right text-[13px] font-medium text-(--color-text-secondary) sm:table-cell">Qty</th>
                <th id="invoice-view--col-unit-price" className="hidden w-32 px-4 py-3 text-right text-[13px] font-medium text-(--color-text-secondary) sm:table-cell">Unit price</th>
                <th id="invoice-view--col-total" className="w-28 px-4 py-3 text-right text-[13px] font-medium text-(--color-text-secondary) sm:w-32 sm:px-6">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item, i) => (
                <tr key={i} id={`invoice-view--line-item-${i}`} className="border-b border-(--color-border) last:border-0">
                  <td className="px-4 py-3 align-top sm:px-6">
                    <span className="break-words">{item.description || <span className="text-(--color-text-secondary)">—</span>}</span>
                    <span className="mt-0.5 block text-sm text-(--color-text-secondary) tabular-nums sm:hidden">
                      {item.quantity} × {fmtCurrency(item.unit_price, cur)}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-right align-top tabular-nums sm:table-cell">{item.quantity}</td>
                  <td className="hidden px-4 py-3 text-right align-top tabular-nums sm:table-cell">{fmtCurrency(item.unit_price, cur)}</td>
                  <td className="px-4 py-3 text-right align-top font-medium tabular-nums sm:px-6">{fmtCurrency(item.quantity * item.unit_price, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div id="invoice-view--totals" className="flex justify-end border-t border-(--color-border) px-4 py-4 sm:px-6">
            <div className="w-full space-y-2 sm:w-72">
              <div className="flex justify-between text-[15px]">
                <span className="text-(--color-text-secondary)">Subtotal</span>
                <span id="invoice-view--subtotal" className="tabular-nums">{fmtCurrency(invoice.subtotal_fiat, cur)}</span>
              </div>
              {invoice.tax_percent > 0 && (
                <div className="flex justify-between text-[15px]">
                  <span className="text-(--color-text-secondary)">Tax ({invoice.tax_percent}%)</span>
                  <span id="invoice-view--tax" className="tabular-nums">{fmtCurrency(invoice.tax_fiat, cur)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-(--color-border) pt-2 text-lg font-semibold">
                <span>Total</span>
                <span id="invoice-view--total" className="tabular-nums">{fmtCurrency(invoice.total_fiat, cur)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* BTC payment */}
        {showBtc && (
          <Card id="invoice-view--btc-section" className="space-y-6">
            <h2 id="invoice-view--btc-heading" className="font-display tracking-heading text-xl font-semibold">Pay with Bitcoin</h2>
            {showPaymentDetails ? (
              <div id="invoice-view--btc-details" className="flex flex-col items-start gap-6 sm:flex-row">
                <div id="invoice-view--qr-frame" className="self-center rounded-(--radius-md) border border-(--color-border) bg-white p-3 sm:self-start">
                  <BtcQrCode uri={bip21Uri!} size={200} />
                </div>
                <div id="invoice-view--btc-fields" className="w-full min-w-0 space-y-5">
                  <div className="space-y-1">
                    <p className={label}>BTC amount</p>
                    <div className="flex items-center justify-between gap-3">
                      <p id="invoice-view--btc-amount" className="font-display text-xl font-bold tabular-nums">
                        {btcAmountDisplay} BTC
                      </p>
                      <CopyButton text={btcAmountDisplay!} label="Copy BTC amount" />
                    </div>
                    <p className="text-sm text-(--color-text-secondary)">
                      at {fmtCurrency(btcPrice!, "USD")}/BTC
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className={label}>Address</p>
                    <div className="flex items-start justify-between gap-3">
                      <p id="invoice-view--btc-address" className="min-w-0 font-mono text-sm break-all">{invoice.btc_address}</p>
                      <CopyButton text={invoice.btc_address!} label="Copy BTC address" />
                    </div>
                  </div>
                  {btcTxid && (
                    <div className="space-y-1">
                      <p className={label}>Transaction ID</p>
                      <a
                        id="invoice-view--btc-txid"
                        href={`${getMempoolBaseUrl()}/tx/${btcTxid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block py-1.5 text-sm ${txLink}`}
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
                size="lg"
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
          </Card>
        )}

        {!invoice.btc_address && (
          <p id="invoice-view--btc-missing" className="text-center text-sm text-(--color-text-secondary)">
            Bitcoin payment details not yet configured for this invoice.
          </p>
        )}

        {invoice.btc_address && !btcPrice && (
          <Card id="invoice-view--btc-price-error" className="space-y-2">
            <h2 className="font-display tracking-heading text-xl font-semibold">Pay with Bitcoin</h2>
            <p className="text-sm text-(--color-text-secondary)">
              Bitcoin address: <span className="font-mono text-sm break-all text-(--color-ink)">{invoice.btc_address}</span>
            </p>
            <p className="text-sm text-(--color-text-secondary)">BTC price unavailable — please calculate the amount manually.</p>
            {btcTxid && (
              <p className="text-sm text-(--color-text-secondary)">
                Transaction:{" "}
                <a
                  id="invoice-view--btc-txid-fallback"
                  href={`${getMempoolBaseUrl()}/tx/${btcTxid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={txLink}
                >
                  {btcTxid}
                </a>
              </p>
            )}
          </Card>
        )}

      </div>
    </main>
  );
}
