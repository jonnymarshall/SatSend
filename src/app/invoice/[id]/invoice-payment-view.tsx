"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CirclePlus, Clock, TriangleAlert, type LucideIcon } from "lucide-react";
import type { PublicInvoice } from "@/lib/invoice-public";
import { fiatToBtc, buildBip21Uri } from "@/lib/btc-qr";
import { BtcQrCode } from "@/components/btc-qr-code";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { InvoiceDates } from "@/components/invoice-dates";
import { PaymentWatcher } from "./payment-watcher";
import { MarkSentButton } from "./mark-sent-button";
import { Button, buttonVariants } from "@/components/signal/button";
import { Card } from "@/components/signal/card";
import { LogoHomeLink } from "@/components/brand/logo-home-link";
import { CopyButton } from "@/components/copy-button";
import { getMempoolBaseUrl } from "@/lib/btc-network";
import { usePublicInvoiceRealtime } from "./use-public-invoice-realtime";

function isPayableStatus(s: PublicInvoice["status"]): boolean {
  return s === "pending" || s === "overdue";
}

// v1.5.27 (roadmap v1.5.2.13-H): once a payment exists the invoice can't be paid
// again, so the page shows no QR and no live BTC amount. Keyed on the txid (from
// the server, the watcher or realtime), with the paid statuses as a backstop.
function hasPayment(s: PublicInvoice["status"], txid: string | null): boolean {
  return !!txid || s === "payment_detected" || s === "paid" || s === "underpaid";
}

function satsToBtc(sats: number): string {
  return (sats / 100_000_000).toFixed(8).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
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

  // v1.5.27: a live update carries only the status and txid, so when a payment
  // lands or confirms during the visit, fetch the invoice again for the amount
  // received and the times. Stops once the server's status matches.
  const router = useRouter();
  useEffect(() => {
    if (status !== invoice.status && hasPayment(status, btcTxid)) router.refresh();
  }, [status, invoice.status, btcTxid, router]);

  // Auto-reveal payment details for invoices that aren't awaiting payment (already
  // detected/paid), so the txid link is visible without an extra click.
  const showPaymentDetails = userRevealedPayment || !isPayableStatus(status);
  const cur = invoice.currency;
  const paymentMade = !!invoice.btc_address && hasPayment(status, btcTxid);
  const showBtc = !!invoice.btc_address && !!btcPrice && !paymentMade;
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
        <LogoHomeLink id="invoice-view--logo" logoStyle={{ width: 116 }} />

        {/* Header */}
        <Card id="invoice-view--header" className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div id="invoice-view--title-block" className="min-w-0 space-y-2">
            <h1 id="invoice-view--title" className="font-display tracking-heading text-[26px] leading-tight font-bold break-words sm:text-[30px]">
              {invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : "Invoice"}
            </h1>
            <InvoiceDates audience="client" sentAt={invoice.sent_at} dueDate={invoice.due_date} />
          </div>
          <div id="invoice-view--header-actions" className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end">
            {invoice.btc_address ? (
              <PaymentWatcher
                invoiceId={invoice.id}
                btcAddress={invoice.btc_address}
                status={status}
                onStatusChange={handleWatcherStatusChange}
                paymentRevealed={showPaymentDetails}
                overpaid={invoice.overpaid}
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

        {paymentMade && (
          <PaymentReceived invoice={invoice} status={status} btcTxid={btcTxid} txLink={txLink} />
        )}

        {invoice.btc_address && !btcPrice && !paymentMade && (
          <Card id="invoice-view--btc-price-error" className="space-y-2">
            <h2 className="font-display tracking-heading text-xl font-semibold">Pay with Bitcoin</h2>
            <p className="text-sm text-(--color-text-secondary)">
              Bitcoin address: <span className="font-mono text-sm break-all text-(--color-ink)">{invoice.btc_address}</span>
            </p>
            <p className="text-sm text-(--color-text-secondary)">BTC price unavailable — please calculate the amount manually.</p>
          </Card>
        )}

      </div>
    </main>
  );
}

type PaymentState = "payment_detected" | "paid" | "underpaid" | "overpaid";

// One look per state (v1.5.27): the same colours as the status badges, plus an
// icon, so the state reads at a glance without the text.
const STATE_LOOK: Record<PaymentState, { heading: string; Icon: LucideIcon; soft: string; text: string }> = {
  payment_detected: { heading: "Payment detected", Icon: Clock, soft: "bg-(--color-detected-soft)", text: "text-(--color-detected-text)" },
  paid: { heading: "Paid", Icon: CircleCheck, soft: "bg-(--color-success-soft)", text: "text-(--color-success-text)" },
  underpaid: { heading: "Underpaid", Icon: TriangleAlert, soft: "bg-(--color-warning-soft)", text: "text-(--color-warning-text)" },
  overpaid: { heading: "Overpaid", Icon: CirclePlus, soft: "bg-(--color-sent-soft)", text: "text-(--color-sent-text)" },
};

function paymentState(invoice: PublicInvoice, status: PublicInvoice["status"]): PaymentState {
  // An archived invoice reads as whatever it was before archiving.
  const shown = status === "archived" ? (invoice.pre_archive_status ?? status) : status;
  if (shown === "underpaid") return "underpaid";
  if (shown === "paid" || shown === "archived") return invoice.overpaid ? "overpaid" : "paid";
  return "payment_detected";
}

function shortTxid(txid: string): string {
  return txid.length > 20 ? `${txid.slice(0, 8)}…${txid.slice(-8)}` : txid;
}

// The server renders in UTC; the browser then shows the payer's own time zone.
// useSyncExternalStore keeps that switch free of hydration mismatches.
const subscribeNever = () => () => {};
function useTimeZone(): string {
  return useSyncExternalStore(
    subscribeNever,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
}

function fmtDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  }).format(new Date(iso));
}

/**
 * What the payer sees once a payment exists (v1.5.27): no QR,
 * no live amount. Wording says the bitcoin arrived at the invoice's address,
 * never that SatSend ("we") received it: SatSend never holds funds (Jonny,
 * 2026-10-27).
 */
function PaymentReceived({
  invoice,
  status,
  btcTxid,
  txLink,
}: {
  invoice: PublicInvoice;
  status: PublicInvoice["status"];
  btcTxid: string | null;
  txLink: string;
}) {
  const timeZone = useTimeZone();
  const cur = invoice.currency;
  const state = paymentState(invoice, status);
  const look = STATE_LOOK[state];
  const sats = invoice.amount_received_sats;
  const fiat = invoice.amount_received_fiat;
  const btc = sats !== null ? `${satsToBtc(sats)} BTC` : null;
  const sender = invoice.your_company || invoice.your_name || "the sender of this invoice";
  // The sums only matter when the amount was wrong.
  const difference = fiat !== null && (state === "underpaid" || state === "overpaid") ? fiat - invoice.total_fiat : null;

  let message: string;
  if (state === "underpaid") {
    message = `${difference !== null ? "This" : "Less than the amount requested"} was received to the bitcoin address for this invoice${difference !== null ? ", less than the amount requested" : ""}. To resolve full settlement of this invoice, reach out to ${sender}.`;
  } else if (state === "overpaid") {
    message = `This was received to the bitcoin address for this invoice, more than the amount requested. To discuss the extra ${fmtCurrency(difference ?? 0, cur)}, reach out to ${sender}.`;
  } else if (state === "paid") {
    message = btc
      ? "was received to the bitcoin address for this invoice."
      : "Payment was received to the bitcoin address for this invoice.";
  } else {
    message =
      "A payment to the bitcoin address for this invoice has been seen and is waiting for confirmation, usually within about 20 minutes.";
  }

  const confirmedAt = state === "payment_detected" ? null : invoice.payment_confirmed_at;
  const time = confirmedAt
    ? { label: "Paid on", iso: confirmedAt }
    : invoice.mempool_seen_at
      ? { label: "Seen at", iso: invoice.mempool_seen_at }
      : null;

  const row = "flex items-start justify-between gap-4";
  const rowLabel = "shrink-0 text-(--color-text-secondary)";

  return (
    <Card id="invoice-view--payment-received" data-state={state} className="space-y-5">
      <div id="invoice-view--payment-summary" className="flex flex-col items-center gap-3 text-center">
        <div id="invoice-view--payment-icon" className={`flex size-16 items-center justify-center rounded-full ${look.soft} ${look.text}`}>
          <look.Icon aria-hidden className="size-8" strokeWidth={2} />
        </div>
        <h2 id="invoice-view--payment-received-heading" className={`font-display tracking-heading text-2xl font-semibold ${look.text}`}>
          {look.heading}
        </h2>
        {state === "paid" && btc && (
          <p id="invoice-view--payment-amount" className="font-display text-xl font-semibold tabular-nums">
            {btc}{fiat !== null && ` · ${fmtCurrency(fiat, cur)}`}
          </p>
        )}
      </div>

      {difference !== null && (
        <div id="invoice-view--payment-sums" className={`space-y-2 rounded-(--radius-md) p-4 text-[15px] ${look.soft}`}>
          <div id="invoice-view--payment-sum-requested" className="flex justify-between gap-3">
            <span className="text-(--color-ink)/70">Requested</span>
            <span className="tabular-nums">{fmtCurrency(invoice.total_fiat, cur)}</span>
          </div>
          <div id="invoice-view--payment-sum-received" className="flex justify-between gap-3">
            <span className="text-(--color-ink)/70">Received</span>
            <span className="text-right tabular-nums">
              {fmtCurrency(fiat!, cur)}
              {btc && <span className="text-(--color-ink)/70 text-[13px]"> ({btc})</span>}
            </span>
          </div>
          <div id="invoice-view--payment-sum-difference" className="flex justify-between gap-3 border-t border-(--color-ink)/10 pt-2 font-semibold">
            <span>Difference</span>
            <span className={`tabular-nums ${look.text}`}>
              {difference < 0 ? "−" : "+"}
              {fmtCurrency(Math.abs(difference), cur)}
            </span>
          </div>
        </div>
      )}

      <p
        id="invoice-view--payment-received-message"
        className={`text-[15px] leading-[1.55] text-(--color-text-secondary) ${difference === null ? "text-center" : ""}`}
      >
        {message}
      </p>

      <div id="invoice-view--payment-details" className="space-y-3 border-t border-(--color-border) pt-5 text-sm">
        {time && (
          <div className={row}>
            <span className={rowLabel}>{time.label}</span>
            <span id="invoice-view--payment-time" className="text-right font-medium">
              {fmtDateTime(time.iso, timeZone)}
            </span>
          </div>
        )}
        <div className={row}>
          <span className={rowLabel}>Address</span>
          <span id="invoice-view--paid-address" className="min-w-0 text-right font-mono text-[13px] break-all">
            {invoice.btc_address}
          </span>
        </div>
        {btcTxid && (
          <div className={row}>
            <span className={rowLabel}>Transaction</span>
            <a
              id="invoice-view--btc-txid"
              href={`${getMempoolBaseUrl()}/tx/${btcTxid}`}
              target="_blank"
              rel="noopener noreferrer"
              title={btcTxid}
              className={`min-w-0 text-right text-[13px] ${txLink}`}
            >
              {shortTxid(btcTxid)}
            </a>
          </div>
        )}
      </div>
    </Card>
  );
}
