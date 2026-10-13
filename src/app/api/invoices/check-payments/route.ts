import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchTipHeight } from "@/lib/mempool";
import {
  CHECKABLE_COLUMNS,
  CHECKABLE_STATUSES,
  checkInvoicePayment,
  type CheckableInvoice,
} from "@/lib/invoices/check-invoice-payment";

/*
 * POST /api/invoices/check-payments (v1.5.8, roadmap v1.5.0.5-H).
 *
 * The /invoices list calls this about once a minute while it is open, so the
 * statuses it shows move on without anyone opening an invoice. It checks the
 * signed-in owner's invoices that are waiting on the blockchain, using the same
 * per-invoice check as the background sweep (checkInvoicePayment), and writes
 * only when a status changes. Realtime then refreshes the list.
 *
 * Limits: at most MAX_CHECKS invoices per call (payment detected first), and one
 * call per owner per COOLDOWN_MS. The cooldown is per server instance (Fluid
 * Compute reuses instances, so it holds in practice); it exists to stop a tab
 * left open, or a script, from hammering mempool.space through us.
 */

const MAX_CHECKS = 10;
const COOLDOWN_MS = 30_000;

const lastCallByOwner = new Map<string, number>();

const PRIORITY: Record<CheckableInvoice["status"], number> = {
  payment_detected: 0,
  overdue: 1,
  pending: 2,
};

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nowMs = Date.now();
  const last = lastCallByOwner.get(user.id);
  if (last !== undefined && nowMs - last < COOLDOWN_MS) {
    return NextResponse.json({ checked: 0, transitioned: 0, throttled: true });
  }
  lastCallByOwner.set(user.id, nowMs);

  // Owner-scoped read through the user's own session (RLS), then the admin
  // client for the write and the owner lookup the emails need (as the sweep).
  const { data: rows, error } = await supabase
    .from("invoices")
    .select(CHECKABLE_COLUMNS)
    .eq("user_id", user.id)
    .in("status", [...CHECKABLE_STATUSES])
    .not("btc_address", "is", null)
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[check-payments] fetch failed", error);
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }

  const waiting = ((rows ?? []) as CheckableInvoice[])
    .slice()
    .sort((a, b) => PRIORITY[a.status] - PRIORITY[b.status])
    .slice(0, MAX_CHECKS);

  if (waiting.length === 0) return NextResponse.json({ checked: 0, transitioned: 0 });

  const admin = createAdminClient();
  const tipHeight = await fetchTipHeight();
  const now = new Date();

  let transitioned = 0;
  for (const inv of waiting) {
    const outcome = await checkInvoicePayment(admin, inv, tipHeight, now, {
      writeOnlyOnStatusChange: true,
      logPrefix: "[check-payments]",
    });
    if (outcome === "transitioned") transitioned += 1;
  }

  return NextResponse.json({ checked: waiting.length, transitioned });
}
