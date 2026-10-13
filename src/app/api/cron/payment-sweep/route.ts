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
import { fetchTipHeight } from "@/lib/mempool";
import { decideOverdueFlip } from "@/lib/invoices/overdue-actions";
import {
  CHECKABLE_COLUMNS,
  CHECKABLE_STATUSES,
  checkInvoicePayment,
  type CheckableInvoice,
} from "@/lib/invoices/check-invoice-payment";
import { logInvoiceEvent } from "@/lib/invoice-events";
import { timingSafeStringEqual } from "@/lib/timing-safe";

// Hobby allows up to 60s for a Node function. The loop below drains the due
// queue within this budget.
export const maxDuration = 60;

const BATCH_SIZE = 50;
// Upper bound on batches per invocation (50 × 10 = 500 invoices). Prevents an
// endless loop if a row ever fails to advance its next_check_at.
const MAX_BATCHES = 10;

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
      .select(CHECKABLE_COLUMNS)
      .in("status", [...CHECKABLE_STATUSES])
      .lte("next_check_at", now.toISOString())
      .order("next_check_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      // Fail loudly (503) so the scheduler's failure alerts fire (v1.5.8):
      // a sweep that cannot read the database is not a quiet "nothing to do".
      console.error("[cron/payment-sweep] fetch failed", fetchError);
      return NextResponse.json({ error: "Could not load due invoices" }, { status: 503 });
    }

    const invoices = (rows ?? []) as CheckableInvoice[];
    if (invoices.length === 0) break;
    processed += invoices.length;

    for (const inv of invoices) {
      const outcome = await checkInvoicePayment(supabase, inv, tipHeight, now, {
        logPrefix: "[cron/payment-sweep]",
      });
      if (outcome === "transitioned") transitions += 1;
      if (outcome === "error" || outcome === "mempool_unreachable") errors += 1;
    }

    if (invoices.length < BATCH_SIZE) break;
  }

  const overdueFlips = await sweepOverdue(supabase, new Date());
  const rescheduled = await rescheduleStoppedWatches(supabase, new Date());
  if (rescheduled > 0) console.info("[cron/payment-sweep] rescheduled stopped watches", rescheduled);

  const summary = { processed, transitions, errors, overdueFlips };
  console.log("[cron/payment-sweep]", summary);
  return NextResponse.json(summary);
}

/**
 * v1.5.8 (v1.5.0.5-H): before this release the pre-payment watch stopped ~48
 * minutes after publish, leaving next_check_at null on unpaid invoices, which
 * the due query above never matches. Put any such invoice back on the schedule
 * (due now); its next check then follows the repeating 30-minute grid. After
 * the first run nothing matches, since the schedule no longer ends while an
 * invoice is payable.
 */
async function rescheduleStoppedWatches(
  supabase: ReturnType<typeof createAdminClient>,
  now: Date
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .update({ next_check_at: now.toISOString() })
      .in("status", ["pending", "overdue"])
      .is("next_check_at", null)
      .not("btc_address", "is", null)
      .select("id");
    if (error) {
      console.error("[cron/payment-sweep] reschedule failed", error);
      return 0;
    }
    return data?.length ?? 0;
  } catch (err) {
    console.error("[cron/payment-sweep] reschedule failed", err);
    return 0;
  }
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
