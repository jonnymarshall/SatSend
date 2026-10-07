"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PRE_MEMPOOL_DELAYS_MS } from "@/lib/invoices/payment-schedule";
import type { Database } from "@/lib/database.types";

export async function bulkArchive(ids: string[]): Promise<{ archived: number; skipped: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Capture each row's current status so unarchive can restore it. Drafts can't be
  // archived (btc_address unique partial index would collide); already-archived rows
  // don't need to be re-archived.
  const { data: rows, error: fetchError } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("user_id", user!.id)
    .in("id", ids)
    .neq("status", "draft")
    .neq("status", "archived");

  if (fetchError) throw new Error(fetchError.message);
  const eligible = rows ?? [];
  if (eligible.length === 0) {
    revalidatePath("/invoices");
    return { archived: 0, skipped: ids.length };
  }

  for (const row of eligible) {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "archived", pre_archive_status: row.status })
      .eq("user_id", user!.id)
      .eq("id", row.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/invoices");
  return { archived: eligible.length, skipped: ids.length - eligible.length };
}

export async function bulkDelete(ids: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Only drafts may be deleted (mirrors the DB delete-guard trigger). Non-draft
  // rows are silently skipped rather than throwing.
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("user_id", user!.id)
    .eq("status", "draft")
    .in("id", ids);

  if (error) throw new Error(error.message);
  revalidatePath("/invoices");
}

export async function bulkUnarchive(ids: string[]): Promise<{ unarchived: number; skipped: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rows, error: fetchError } = await supabase
    .from("invoices")
    .select("id, pre_archive_status")
    .eq("user_id", user!.id)
    .in("id", ids)
    .eq("status", "archived");

  if (fetchError) throw new Error(fetchError.message);

  const archived = rows ?? [];
  // A row with no recorded prior status (a legacy NULL) is left archived rather
  // than guessed at: defaulting it to 'pending' could silently downgrade a
  // previously-paid invoice, the worst outcome in a payments app. Report it so
  // the caller can ask the user to set the status manually. (v1.4.23-H / M-DB-4)
  const restorable = archived.filter((row) => row.pre_archive_status !== null);

  const MONITORABLE = new Set(["pending", "overdue", "payment_detected"]);
  for (const row of restorable) {
    const restored = row.pre_archive_status!;
    const patch: Database["public"]["Tables"]["invoices"]["Update"] = { status: restored, pre_archive_status: null };
    // Resume monitoring from scratch when restoring to a status the sweep
    // watches (v1.4.22-H / M-DB-3), so the archived row's stale schedule and
    // txid don't linger. A restored paid/underpaid row keeps its record.
    if (MONITORABLE.has(restored)) {
      patch.published_at = new Date().toISOString();
      patch.next_check_at = new Date(Date.now() + PRE_MEMPOOL_DELAYS_MS[0]).toISOString();
      patch.stage_attempt = 0;
      patch.mempool_seen_at = null;
      patch.btc_txid = null;
    }
    const { error } = await supabase
      .from("invoices")
      .update(patch)
      .eq("user_id", user!.id)
      .eq("id", row.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/invoices");
  return { unarchived: restorable.length, skipped: ids.length - restorable.length };
}

export async function bulkMarkPaid(ids: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid" })
    .eq("user_id", user!.id)
    .in("id", ids);

  if (error) throw new Error(error.message);
  revalidatePath("/invoices");
}
