import type { createAdminClient } from "@/lib/supabase/admin";
import { addressNetworkError } from "@/lib/btc-network";
import { isValidBtcAddress } from "@/lib/invoices";
import {
  CHECKABLE_COLUMNS,
  CHECKABLE_STATUSES,
  checkInvoicePayment,
  type CheckableInvoice,
  type CheckOutcome,
} from "@/lib/invoices/check-invoice-payment";

type Admin = ReturnType<typeof createAdminClient>;

const BATCH_SIZE = 50;
// Upper bound on batches per invocation (50 × 10 = 500 invoices). Prevents an
// endless loop if a row ever fails to advance its next_check_at.
const MAX_BATCHES = 10;

/**
 * Stop starting new checks after this long (v1.5.13, roadmap v1.5.0.7-H).
 * cron-job.org gives up after 30 s and emails a "Timeout" failure; a check
 * started just before the budget can still take ~15 s (address lookup 10 s,
 * price 5 s), so 15 s keeps a slow minute inside 30. Unchecked invoices stay
 * due and go first next minute.
 */
export const SWEEP_BUDGET_MS = 15_000;

export interface SweepResult {
  processed: number;
  transitions: number;
  errors: number;
  invalid: number;
  budgetReached: boolean;
  fetchFailed: boolean;
}

export interface SweepOptions {
  now?: () => Date;
  clock?: () => number;
  /** When the request started (clock time), so the tip-height lookup counts too. */
  startedAt?: number;
  budgetMs?: number;
  check?: typeof checkInvoicePayment;
}

/**
 * Drain the due queue: process a batch, then loop while a full batch was
 * returned. Rows leave the due set as their next_check_at advances, so the next
 * query does not re-fetch them.
 */
export async function sweepDueInvoices(
  supabase: Admin,
  tipHeight: number | null,
  {
    now = () => new Date(),
    clock = Date.now,
    startedAt = clock(),
    budgetMs = SWEEP_BUDGET_MS,
    check = checkInvoicePayment,
  }: SweepOptions = {}
): Promise<SweepResult> {
  const result: SweepResult = {
    processed: 0,
    transitions: 0,
    errors: 0,
    invalid: 0,
    budgetReached: false,
    fetchFailed: false,
  };

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const batchNow = now();
    const { data: rows, error } = await supabase
      .from("invoices")
      .select(CHECKABLE_COLUMNS)
      .in("status", [...CHECKABLE_STATUSES])
      .lte("next_check_at", batchNow.toISOString())
      .order("next_check_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      console.error("[cron/payment-sweep] fetch failed", error);
      result.fetchFailed = true;
      return result;
    }

    const invoices = (rows ?? []) as CheckableInvoice[];
    if (invoices.length === 0) break;

    for (const inv of invoices) {
      if (clock() - startedAt >= budgetMs) {
        result.budgetReached = true;
        return result;
      }
      result.processed += 1;
      const outcome: CheckOutcome = await check(supabase, inv, tipHeight, batchNow, {
        logPrefix: "[cron/payment-sweep]",
      });
      if (outcome === "transitioned") result.transitions += 1;
      if (outcome === "error" || outcome === "mempool_unreachable") result.errors += 1;
      if (outcome === "invalid_address") result.invalid += 1;
    }

    if (invoices.length < BATCH_SIZE) break;
  }

  return result;
}

/**
 * v1.5.8 (v1.5.0.5-H): before that release the pre-payment watch stopped ~48
 * minutes after publish, leaving next_check_at null on unpaid invoices, which
 * the due query never matches. Put any such invoice back on the schedule (due
 * now); its next check then follows the repeating 30-minute grid.
 *
 * v1.5.13: an address this network can't look up also has its watch stopped
 * (checkInvoicePayment), and must stay stopped, or it would be re-checked every
 * minute again.
 */
export async function rescheduleStoppedWatches(supabase: Admin, now: Date): Promise<number> {
  try {
    const { data: stopped, error: readError } = await supabase
      .from("invoices")
      .select("id, btc_address")
      .in("status", ["pending", "overdue"])
      .is("next_check_at", null)
      .not("btc_address", "is", null);
    if (readError) {
      console.error("[cron/payment-sweep] reschedule failed", readError);
      return 0;
    }

    const ids = (stopped ?? [])
      .filter((r) => r.btc_address && isValidBtcAddress(r.btc_address) && !addressNetworkError(r.btc_address))
      .map((r) => r.id);
    if (ids.length === 0) return 0;

    const { data, error } = await supabase
      .from("invoices")
      .update({ next_check_at: now.toISOString() })
      .in("id", ids)
      .is("next_check_at", null)
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
