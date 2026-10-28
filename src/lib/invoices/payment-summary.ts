import type { Invoice } from "@/lib/invoice-public";
import { isWithinAllowance } from "./payment-schedule";

/**
 * The payment block, worked out once (v1.5.28, roadmap v1.5.2.21-H): the state,
 * the sums, the next-step sentence and the time. Read by the client's invoice
 * page, the four payment emails and the PDF, so they say the same thing.
 *
 * Wording rules (Jonny, 2026-10-27): never imply SatSend received or holds the
 * bitcoin; the box says what arrived, the sentence only says what to do next.
 */

export type PaymentState = "payment_detected" | "paid" | "underpaid" | "overpaid";

/** Who reads it: the client is pointed to the sender, the sender to the client. */
export type PaymentAudience = "client" | "sender";

export type PaymentSummaryInvoice = Pick<
  Invoice,
  | "status"
  | "pre_archive_status"
  | "overpaid"
  | "total_fiat"
  | "currency"
  | "amount_received_sats"
  | "amount_received_fiat"
  | "payment_confirmed_at"
  | "mempool_seen_at"
  | "your_company"
  | "your_name"
  | "client_company"
  | "client_name"
>;

export interface PaymentSums {
  requested: string;
  received: string;
  receivedBtc: string | null;
  /** "+$0.75" / "−$2.00" for a paid invoice inside the allowance, else null. */
  rateVariance: string | null;
  /** "$0.00" paid, "$38.50" underpaid, "−$12.00" overpaid. */
  outstanding: string;
}

export interface PaymentSummary {
  state: PaymentState;
  heading: string;
  sums: PaymentSums | null;
  message: string | null;
  time: { label: "Paid on" | "Seen at"; iso: string } | null;
}

const HEADINGS: Record<PaymentState, string> = {
  payment_detected: "Payment detected",
  paid: "Paid",
  underpaid: "Underpaid",
  overpaid: "Overpaid",
};

/** What "Exchange Rate Variance" means: the page's help pop-up, the emails' and PDF's note. */
export const RATE_VARIANCE_EXPLAINED = [
  "The bitcoin amount was set by the exchange rate at the time of payment. The value shown here uses the rate when the payment confirmed, a little later, so the two can differ slightly.",
  "A small difference like this counts as paid in full, so nothing is outstanding.",
] as const;

export const DETECTED_MESSAGE =
  "A payment to the bitcoin address for this invoice has been seen and is waiting for confirmation, usually within about 20 minutes.";

/**
 * Once a payment exists the invoice can't be paid again (v1.5.27): keyed on the
 * txid, with the paid statuses as a backstop.
 */
export function hasPayment(status: Invoice["status"], txid: string | null): boolean {
  return !!txid || status === "payment_detected" || status === "paid" || status === "underpaid";
}

export function satsToBtc(sats: number): string {
  return (sats / 100_000_000).toFixed(8).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export function shortTxid(txid: string): string {
  return txid.length > 20 ? `${txid.slice(0, 8)}…${txid.slice(-8)}` : txid;
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

/** A signed amount with a real minus sign: "−$12.00", "+$0.75", "$0.00". */
function fmtSigned(amount: number, currency: string, plus: boolean) {
  if (amount === 0) return fmtCurrency(0, currency);
  const sign = amount < 0 ? "−" : plus ? "+" : "";
  return `${sign}${fmtCurrency(Math.abs(amount), currency)}`;
}

/** "Oct 27, 2026, 12:32 PM UTC": the zone is always named. */
export function formatPaymentTime(iso: string, timeZone: string): string {
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

/** A time zone the runtime recognises, else UTC (it arrives in a URL). */
export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function paymentState(invoice: PaymentSummaryInvoice, status: Invoice["status"] = invoice.status): PaymentState {
  // An archived invoice reads as whatever it was before archiving.
  const shown = status === "archived" ? (invoice.pre_archive_status ?? status) : status;
  if (shown === "underpaid") return "underpaid";
  if (shown === "paid" || shown === "archived") return invoice.overpaid ? "overpaid" : "paid";
  return "payment_detected";
}

export function paymentSummary(
  invoice: PaymentSummaryInvoice,
  { audience, status }: { audience: PaymentAudience; status?: Invoice["status"] },
): PaymentSummary {
  const cur = invoice.currency;
  const state = paymentState(invoice, status ?? invoice.status);
  const fiat = invoice.amount_received_fiat;
  const sats = invoice.amount_received_sats;
  const sender = invoice.your_company || invoice.your_name || "the sender of this invoice";
  const client = invoice.client_company || invoice.client_name || "your client";
  const reachOut = audience === "client" ? sender : client;

  // A paid invoice with no amount recorded, or a gap beyond the allowance, was
  // marked paid by the sender by hand (say, an underpaid invoice settled some
  // other way). Calling that gap exchange rate movement would be untrue.
  const markedPaidBySender = state === "paid" && (fiat === null || !isWithinAllowance(fiat, invoice.total_fiat));

  let sums: PaymentSums | null = null;
  if (fiat !== null && state !== "payment_detected") {
    // What's still owed: nothing once paid (within the allowance counts as in
    // full), the rest when underpaid, below zero when overpaid (Jonny, 2026-10-27).
    const outstanding = state === "paid" ? 0 : invoice.total_fiat - fiat;
    // Worked out from the rounded cents the rows show, so Requested + this row
    // always equals Received.
    const variance =
      state === "paid" && !markedPaidBySender ? (Math.round(fiat * 100) - Math.round(invoice.total_fiat * 100)) / 100 : 0;
    sums = {
      requested: fmtCurrency(invoice.total_fiat, cur),
      received: fmtCurrency(fiat, cur),
      receivedBtc: sats !== null ? `${satsToBtc(sats)} BTC` : null,
      rateVariance: variance !== 0 ? fmtSigned(variance, cur, true) : null,
      outstanding: fmtSigned(outstanding, cur, false),
    };
  }

  let message: string | null = null;
  if (state === "underpaid") {
    message = `To resolve full settlement of this invoice, reach out to ${reachOut}.`;
  } else if (state === "overpaid") {
    message = `To resolve overpayment of this invoice, reach out to ${reachOut}.`;
  } else if (markedPaidBySender) {
    message = `Marked as paid by ${audience === "client" ? sender : "you"}.`;
  } else if (state === "payment_detected") {
    message = DETECTED_MESSAGE;
  }

  const confirmedAt = state === "payment_detected" ? null : invoice.payment_confirmed_at;
  const time = confirmedAt
    ? { label: "Paid on" as const, iso: confirmedAt }
    : invoice.mempool_seen_at
      ? { label: "Seen at" as const, iso: invoice.mempool_seen_at }
      : null;

  return { state, heading: HEADINGS[state], sums, message, time };
}
