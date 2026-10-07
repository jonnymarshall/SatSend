// Background payment sweep.
//
// v1.4.28-H (S3): this runs from an external scheduler roughly every 5 minutes
// (a GitHub Actions workflow — see .github/workflows/payment-sweep.yml), not on
// Vercel Cron's once-a-day Hobby cap. The per-invoice schedule is time-based
// (see payment-schedule.ts), so a sparse or missed tick no longer burns a stage.
//
// Polls mempool.space for every invoice whose next_check_at has arrived and
// transitions its status (pending/overdue → payment_detected → paid) on matching
// txs. Drains the due queue past a single batch so a backlog catches up quickly.
//
// Manual test in dev (the external scheduler only runs in production):
//   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/payment-sweep

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAddressTxs, fetchTipHeight } from "@/lib/mempool";
import { fetchBtcPrice } from "@/lib/btc-price";
import { decidePaymentSchedule } from "@/lib/invoices/payment-schedule";
import { decideOverdueFlip } from "@/lib/invoices/overdue-actions";
import { sendPaymentDetectedEmail, sendPaymentConfirmedEmail } from "@/lib/email/send";
import { logInvoiceEvent } from "@/lib/invoice-events";
import { timingSafeStringEqual } from "@/lib/timing-safe";

// Hobby allows up to 60s for a Node function. The loop below drains the due
// queue within this budget.
export const maxDuration = 60;

const BATCH_SIZE = 50;
// Upper bound on batches per invocation (50 × 10 = 500 invoices). Prevents an
// endless loop if a row ever fails to advance its next_check_at.
const MAX_BATCHES = 10;

interface InvoiceRow {
  id: string;
  user_id: string;
  btc_address: string;
  status: "pending" | "payment_detected" | "overdue";
  mempool_seen_at: string | null;
  published_at: string | null;
  stage_attempt: number;
  invoice_number: string | null;
  client_name: string;
  client_email: string | null;
  total_fiat: number;
  currency: string;
  btc_txid: string | null;
  your_name: string | null;
  your_company: string | null;
  your_email: string | null;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  // Constant-time compare (v1.4.25-H): a plain !== leaks length/prefix timing.
  if (!secret || !timingSafeStringEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Single-writer guard (v1.4.19.2-H / S2.2). Only the environment that is
  // explicitly allowed to sweep may run this. Set PAYMENT_SWEEP_ENABLED=true in
  // exactly one place: the environment that should own the sweep (the current
  // production deployment). A stray, test, or stale deployment that does not set
  // it no-ops here instead of writing to the database.
  if (process.env.PAYMENT_SWEEP_ENABLED !== "true") {
    console.warn("[cron/payment-sweep] skipped: PAYMENT_SWEEP_ENABLED is not 'true'");
    return NextResponse.json({ skipped: true, reason: "PAYMENT_SWEEP_ENABLED is not 'true'" });
  }

  const supabase = createAdminClient();
  const tipHeight = await fetchTipHeight();

  let processed = 0;
  let transitions = 0;
  let errors = 0;

  // Drain the due queue: process a batch, then loop while a full batch was
  // returned. Rows leave the due set as their next_check_at advances, so the
  // next query does not re-fetch them.
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const now = new Date();

    const { data: rows, error: fetchError } = await supabase
      .from("invoices")
      .select(
        "id, user_id, btc_address, status, mempool_seen_at, published_at, stage_attempt, invoice_number, client_name, client_email, total_fiat, currency, btc_txid, your_name, your_company, your_email"
      )
      .in("status", ["pending", "payment_detected", "overdue"])
      .lte("next_check_at", now.toISOString())
      .order("next_check_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("[cron/payment-sweep] fetch failed", fetchError);
      errors += 1;
      break;
    }

    const invoices = (rows ?? []) as InvoiceRow[];
    if (invoices.length === 0) break;
    processed += invoices.length;

    for (const inv of invoices) {
      try {
        const txs = await fetchAddressTxs(inv.btc_address);
        if (txs === null) {
          // mempool.space was unreachable — NOT the same as "no payment yet".
          // Skip this invoice without touching its schedule, so an outage does
          // not burn an attempt or stop the watch. (v1.4.22-H / M-MONEY-2)
          errors += 1;
          console.warn("[cron/payment-sweep] mempool unreachable, deferring", inv.id);
          continue;
        }

        let btcPrice: number | null = null;
        try {
          btcPrice = (await fetchBtcPrice(inv.currency)).price;
        } catch {
          // Oracle unavailable — decidePaymentSchedule defers rather than guessing.
        }

        const decision = decidePaymentSchedule(
          {
            status: inv.status,
            btc_address: inv.btc_address,
            mempool_seen_at: inv.mempool_seen_at,
            published_at: inv.published_at,
            stage_attempt: inv.stage_attempt,
            total_fiat: inv.total_fiat,
          },
          txs,
          now,
          { btcPrice, tipHeight }
        );

        const update: Record<string, unknown> = {
          status: decision.newStatus,
          mempool_seen_at: decision.newMempoolSeenAt,
          stage_attempt: decision.newStageAttempt,
          next_check_at: decision.newNextCheckAt,
          amount_received_sats: decision.amountReceivedSats,
          btc_price_at_detection: decision.btcPriceAtDetection,
          amount_received_fiat: decision.amountReceivedFiat,
          overpaid: decision.overpaid,
        };
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
          errors += 1;
          console.error("[cron/payment-sweep] update failed", inv.id, updateError);
          continue;
        }

        if (!updatedRows || updatedRows.length === 0) {
          // The optimistic-concurrency filter matched nothing: another writer
          // (the payer's fast-path route) already moved this row on. Skip the
          // email side effects so we don't double-send. (v1.4.22-H / M-DB-1)
          continue;
        }

        if (decision.newStatus !== inv.status && decision.detectedTxid) {
          transitions += 1;
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
            };
            if (decision.newStatus === "paid" || decision.newStatus === "underpaid") {
              await sendPaymentConfirmedEmail({
                ...emailArgs,
                status: decision.newStatus,
                amountReceivedFiat: decision.amountReceivedFiat,
                overpaid: decision.overpaid,
              });
            } else {
              await sendPaymentDetectedEmail(emailArgs);
            }
          }
        }
      } catch (err) {
        errors += 1;
        console.error("[cron/payment-sweep] invoice failed", inv.id, err);
      }
    }

    if (invoices.length < BATCH_SIZE) break;
  }

  const overdueFlips = await sweepOverdue(supabase, new Date());

  const summary = { processed, transitions, errors, overdueFlips };
  console.log("[cron/payment-sweep]", summary);
  return NextResponse.json(summary);
}

interface OverdueScanRow {
  id: string;
  user_id: string;
  status: "pending";
  due_date: string;
}

async function sweepOverdue(
  supabase: ReturnType<typeof createAdminClient>,
  now: Date
): Promise<number> {
  // Calendar-day comparison: any invoice whose due_date is strictly before
  // today's UTC date is overdue. Same-day invoices keep the rest of today.
  const todayStr = now.toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from("invoices")
    .select("id, user_id, status, due_date")
    .eq("status", "pending")
    .not("due_date", "is", null)
    .lt("due_date", todayStr);

  if (error) {
    console.error("[cron/payment-sweep] overdue scan failed", error);
    return 0;
  }

  let flipped = 0;
  for (const inv of (rows ?? []) as OverdueScanRow[]) {
    const decision = decideOverdueFlip({ status: inv.status, due_date: inv.due_date }, now);
    if (!decision.shouldFlip) continue;

    const { error: updateError } = await supabase
      .from("invoices")
      .update({ status: "overdue" })
      .eq("id", inv.id)
      .eq("status", "pending");

    if (updateError) {
      console.error("[cron/payment-sweep] overdue flip failed", inv.id, updateError);
      continue;
    }

    flipped += 1;
    await logInvoiceEvent({
      invoiceId: inv.id,
      userId: inv.user_id,
      eventType: "marked_as_overdue",
    });
  }
  return flipped;
}
