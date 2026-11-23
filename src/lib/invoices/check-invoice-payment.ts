import { fetchAddressTxs } from "@/lib/mempool";
import { addressNetworkError } from "@/lib/btc-network";
import { isValidBtcAddress } from "@/lib/invoices";
import { fetchBtcPrice } from "@/lib/btc-price";
import { decidePaymentSchedule, type ScheduleDecision } from "@/lib/invoices/payment-schedule";
import type { PaymentSummaryInvoice } from "@/lib/invoices/payment-summary";
import type { PaymentQuote } from "@/lib/invoices/quotes";
import { sendPaymentDetectedEmail, sendPaymentConfirmedEmail } from "@/lib/email/send";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Invoice } from "@/lib/invoice-public";
import type { Database } from "@/lib/database.types";

/*
 * One blockchain check for one invoice (v1.5.8, roadmap v1.5.0.5-H). Shared by
 * the background sweep (/api/cron/payment-sweep) and the /invoices list check
 * (/api/invoices/check-payments) so the two cannot drift: same decision
 * (decidePaymentSchedule), same optimistic-concurrency write, same emails.
 */

// Payable invoices only, so status is narrowed and btc_address is non-null
// (the DB CHECK: status='draft' or btc_address is not null).
export type CheckableInvoice = Pick<
  Invoice,
  | "id"
  | "user_id"
  | "btc_address"
  | "mempool_seen_at"
  | "published_at"
  | "stage_attempt"
  | "invoice_number"
  | "client_name"
  | "client_company"
  | "client_email"
  | "total_fiat"
  | "currency"
  | "btc_txid"
  | "your_name"
  | "your_company"
  | "your_email"
  | "btc_price_at_seen"
> & { status: "pending" | "payment_detected" | "overdue"; btc_address: string };

export const CHECKABLE_COLUMNS =
  "id, user_id, btc_address, status, mempool_seen_at, published_at, stage_attempt, invoice_number, client_name, client_company, client_email, total_fiat, currency, btc_txid, your_name, your_company, your_email, btc_price_at_seen";

export const CHECKABLE_STATUSES = ["pending", "payment_detected", "overdue"] as const;

/**
 * The invoice as it stands after a decision, for the payment emails' block
 * (v1.5.28). Built from the decision because the emails go out before anything
 * re-reads the row.
 */
export function paymentAfterDecision(
  inv: Pick<Invoice, "total_fiat" | "currency" | "your_company" | "your_name" | "client_company" | "client_name">,
  decision: ScheduleDecision,
): PaymentSummaryInvoice {
  return {
    status: decision.newStatus,
    pre_archive_status: null,
    overpaid: decision.overpaid,
    total_fiat: inv.total_fiat,
    currency: inv.currency,
    amount_received_sats: decision.amountReceivedSats,
    amount_received_fiat: decision.amountReceivedFiat,
    payment_confirmed_at: decision.confirmedAt,
    mempool_seen_at: decision.newMempoolSeenAt,
    slippage_tolerance_fiat: decision.slippageToleranceFiat,
    your_company: inv.your_company,
    your_name: inv.your_name,
    client_company: inv.client_company,
    client_name: inv.client_name,
  };
}

/**
 * The columns a decision writes (v1.5.29: shared by the background check and
 * the payer's route, so the two can't drift). The txid and revert handling stay
 * with each caller.
 */
export function decisionColumns(decision: ScheduleDecision): Database["public"]["Tables"]["invoices"]["Update"] {
  return {
    status: decision.newStatus,
    mempool_seen_at: decision.newMempoolSeenAt,
    stage_attempt: decision.newStageAttempt,
    next_check_at: decision.newNextCheckAt,
    amount_received_sats: decision.amountReceivedSats,
    btc_price_at_detection: decision.btcPriceAtDetection,
    amount_received_fiat: decision.amountReceivedFiat,
    overpaid: decision.overpaid,
    payment_confirmed_at: decision.confirmedAt,
    btc_price_at_seen: decision.btcPriceAtSeen,
    payment_quote_id: decision.paymentQuoteId,
    slippage_tolerance_fiat: decision.slippageToleranceFiat,
  };
}

/**
 * The quotes the client was shown for an invoice (v1.5.29), or null if they
 * can't be read: then the caller defers rather than judge without them.
 */
export async function loadQuotes(
  supabase: ReturnType<typeof createAdminClient>,
  invoiceId: string,
): Promise<PaymentQuote[] | null> {
  const { data, error } = await supabase
    .from("invoice_quotes")
    .select("id, amount_sats, btc_price, created_at, expires_at")
    .eq("invoice_id", invoiceId);
  if (error) {
    console.error("[payment-check] reading quotes failed", invoiceId, error);
    return null;
  }
  return data ?? [];
}

export type CheckOutcome =
  | "transitioned" // a payment moved the status on (emails sent)
  | "unchanged" // checked, nothing new
  | "lost_race" // another writer moved the row first; no emails
  | "mempool_unreachable" // deferred, schedule untouched
  | "invalid_address" // malformed or other-network address: watch stopped, never looked up
  | "error";

export interface CheckOptions {
  /**
   * Write the row only when the status changes. The list check sets this: its
   * extra look must not push the sweep's schedule around, and every write fires
   * a realtime event that refreshes the list.
   */
  writeOnlyOnStatusChange?: boolean;
  logPrefix?: string;
}

export async function checkInvoicePayment(
  supabase: ReturnType<typeof createAdminClient>,
  inv: CheckableInvoice,
  tipHeight: number | null,
  now: Date,
  { writeOnlyOnStatusChange = false, logPrefix = "[payment-check]" }: CheckOptions = {}
): Promise<CheckOutcome> {
  try {
    if (!isValidBtcAddress(inv.btc_address) || addressNetworkError(inv.btc_address)) {
      // mempool.space can never answer for this address (v1.5.13, roadmap
      // v1.5.0.7-H): wrong network, or junk from before publish validated it.
      // Stop the watch instead of re-checking it every minute; the list check
      // only reports it. Publishing refuses such addresses, so only old rows hit this.
      if (writeOnlyOnStatusChange) return "invalid_address";
      console.warn(`${logPrefix} address can't be checked on this network, stopping its watch`, inv.id);
      const { error } = await supabase
        .from("invoices")
        .update({ next_check_at: null })
        .eq("id", inv.id)
        .eq("status", inv.status)
        .select("id");
      if (error) console.error(`${logPrefix} stopping watch failed`, inv.id, error);
      return "invalid_address";
    }

    const txs = await fetchAddressTxs(inv.btc_address);
    if (txs === null) {
      // mempool.space was unreachable — NOT the same as "no payment yet".
      // Skip this invoice without touching its schedule, so an outage does
      // not burn an attempt or stop the watch. (v1.4.22-H / M-MONEY-2)
      console.warn(`${logPrefix} mempool unreachable, deferring`, inv.id);
      return "mempool_unreachable";
    }

    let btcPrice: number | null = null;
    try {
      btcPrice = (await fetchBtcPrice(inv.currency)).price;
    } catch {
      // Oracle unavailable — decidePaymentSchedule defers rather than guessing.
    }

    // Quotes only matter for a verdict, so only once a payment has confirmed.
    const quotes = txs.some((tx) => tx.status.confirmed) ? await loadQuotes(supabase, inv.id) : [];
    if (quotes === null) return "error";

    const decision = decidePaymentSchedule(
      {
        status: inv.status,
        btc_address: inv.btc_address,
        mempool_seen_at: inv.mempool_seen_at,
        published_at: inv.published_at,
        stage_attempt: inv.stage_attempt,
        total_fiat: inv.total_fiat,
        btc_price_at_seen: inv.btc_price_at_seen,
        quotes,
      },
      txs,
      now,
      { btcPrice, tipHeight }
    );

    const statusChanges = decision.newStatus !== inv.status;
    if (writeOnlyOnStatusChange && !statusChanges) return "unchanged";

    const update = decisionColumns(decision);
    if (decision.detectedTxid) {
      update.btc_txid = decision.detectedTxid;
    }
    if (decision.revertToPending) {
      // The previously-seen payment vanished. Clear the stale txid and
      // re-anchor the time-based schedule so the fresh pre-mempool watch
      // starts from now rather than an old published_at. (M-MONEY-4)
      update.btc_txid = null;
      update.published_at = now.toISOString();
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from("invoices")
      .update(update)
      .eq("id", inv.id)
      .eq("status", inv.status)
      .select("id");

    if (updateError) {
      console.error(`${logPrefix} update failed`, inv.id, updateError);
      return "error";
    }

    if (!updatedRows || updatedRows.length === 0) {
      // The optimistic-concurrency filter matched nothing: another writer
      // (the sweep, the list check, or the payer's fast-path route) already
      // moved this row on. Skip the email side effects so we don't double-send.
      // (v1.4.22-H / M-DB-1)
      return "lost_race";
    }

    if (statusChanges && decision.detectedTxid) {
      const { data: userRecord } = await supabase.auth.admin.getUserById(inv.user_id);
      const ownerEmail = userRecord?.user?.email;
      if (ownerEmail) {
        const emailArgs = {
          ownerEmail,
          payerEmail: inv.client_email || null,
          userId: inv.user_id,
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          senderName: inv.your_name || inv.your_company || inv.your_email || "SatSend user",
          clientName: inv.client_name || "your client",
          totalFiat: inv.total_fiat,
          currency: inv.currency,
          txid: decision.detectedTxid,
          btcAddress: inv.btc_address,
          payment: paymentAfterDecision(inv, decision),
        };
        if (decision.newStatus === "paid" || decision.newStatus === "underpaid") {
          await sendPaymentConfirmedEmail(emailArgs);
        } else {
          await sendPaymentDetectedEmail(emailArgs);
        }
      }
      return "transitioned";
    }

    // A revert to pending (payment vanished) changes status without a txid; it
    // is not counted as a transition and sends no email (as before).
    return "unchanged";
  } catch (err) {
    console.error(`${logPrefix} invoice failed`, inv.id, err);
    return "error";
  }
}
