import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchTx, txPaysToAddress, type MempoolTx } from "@/lib/mempool";
import { decidePaymentSchedule } from "@/lib/invoices/payment-schedule";
import { sendPaymentDetectedEmail, sendPaymentConfirmedEmail } from "@/lib/email/send";

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  payment_detected: 1,
  paid: 2,
};

// Only these statuses can transition via watcher-driven payment detection.
// Drafts, archived, and (already-)paid invoices are rejected at the route gate
// so a misbehaving watcher cannot corrupt their state.
const PAYABLE_STATUSES = new Set(["pending", "payment_detected", "overdue"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { txid?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { txid, status } = body;
  if (!txid) return NextResponse.json({ error: "txid required" }, { status: 400 });
  if (status !== "payment_detected" && status !== "paid") {
    return NextResponse.json({ error: "status must be payment_detected or paid" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "id, btc_address, status, user_id, invoice_number, client_name, client_email, total_fiat, currency, mempool_seen_at, stage_attempt, your_name, your_company, your_email"
    )
    .eq("id", id)
    .single();

  if (error || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const currentOrder = STATUS_ORDER[invoice.status] ?? -1;
  const newOrder = STATUS_ORDER[status];
  if (newOrder <= currentOrder) {
    return NextResponse.json({ status: invoice.status });
  }

  if (!PAYABLE_STATUSES.has(invoice.status)) {
    return NextResponse.json(
      { error: "Invoice is not in a payable state", status: invoice.status },
      { status: 409 },
    );
  }

  const tx = await fetchTx(txid);
  if (!tx || !txPaysToAddress(tx, invoice.btc_address)) {
    return NextResponse.json({ error: "Transaction does not pay to invoice address" }, { status: 400 });
  }

  // Synthesize a tx-list reflecting the client-reported transition (confirmed vs. unconfirmed)
  // and delegate to the shared scheduler so next_check_at / stage_attempt / mempool_seen_at
  // stay consistent with the background cron.
  const syntheticTx: MempoolTx = {
    txid,
    status: { confirmed: status === "paid" },
    vout: [{ scriptpubkey_address: invoice.btc_address, value: 0 }],
  };
  const decision = decidePaymentSchedule(
    {
      status: invoice.status as "pending" | "payment_detected",
      btc_address: invoice.btc_address,
      mempool_seen_at: invoice.mempool_seen_at,
      stage_attempt: invoice.stage_attempt,
    },
    [syntheticTx],
    new Date()
  );

  // v1.4.14: stamp the on-chain confirmation fields when the watcher reports
  // a transition to `paid`. This is what makes the Mark-as-unpaid gate hide
  // the button for on-chain payments — without these fields set, the gate
  // would let owners revert an on-chain payment, which would then be
  // re-detected on the next cron sweep (loop).
  const onchainPatch =
    decision.newStatus === "paid"
      ? {
          payment_method: "bitcoin" as const,
          payment_confirmation_method: "onchain" as const,
          paid_at: new Date().toISOString(),
        }
      : {};

  const { data: updated, error: updateError } = await supabase
    .from("invoices")
    .update({
      status: decision.newStatus,
      btc_txid: decision.detectedTxid ?? txid,
      mempool_seen_at: decision.newMempoolSeenAt,
      stage_attempt: decision.newStageAttempt,
      next_check_at: decision.newNextCheckAt,
      ...onchainPatch,
    })
    .eq("id", id)
    .eq("status", invoice.status)
    .select("status")
    .single();

  if (updateError) {
    // PGRST116 = 0 rows matched (status already changed, idempotent — return requested status)
    if (updateError.code === "PGRST116") {
      return NextResponse.json({ status });
    }
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");

  if (decision.newStatus !== invoice.status) {
    const { data: userRecord } = await supabase.auth.admin.getUserById(invoice.user_id);
    const ownerEmail = userRecord?.user?.email;
    if (ownerEmail) {
      const emailArgs = {
        ownerEmail,
        payerEmail: invoice.client_email || null,
        userId: invoice.user_id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        senderName: invoice.your_name || invoice.your_company || invoice.your_email || "Paybitty user",
        clientName: invoice.client_name || "your client",
        totalFiat: invoice.total_fiat,
        currency: invoice.currency,
        txid,
      };
      if (decision.newStatus === "paid") {
        await sendPaymentConfirmedEmail(emailArgs);
      } else {
        await sendPaymentDetectedEmail(emailArgs);
      }
    }
  }

  return NextResponse.json({ status: updated.status });
}
