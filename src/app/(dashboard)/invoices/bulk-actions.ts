"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  const eligible = (rows ?? []) as { id: string; status: string }[];
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

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("user_id", user!.id)
    .in("id", ids);

  if (error) throw new Error(error.message);
  revalidatePath("/invoices");
}

export async function bulkUnarchive(ids: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rows, error: fetchError } = await supabase
    .from("invoices")
    .select("id, pre_archive_status")
    .eq("user_id", user!.id)
    .in("id", ids)
    .eq("status", "archived");

  if (fetchError) throw new Error(fetchError.message);
  if (!rows || rows.length === 0) {
    revalidatePath("/invoices");
    return;
  }

  for (const row of rows as { id: string; pre_archive_status: string | null }[]) {
    const { error } = await supabase
      .from("invoices")
      .update({ status: row.pre_archive_status ?? "pending", pre_archive_status: null })
      .eq("user_id", user!.id)
      .eq("id", row.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/invoices");
}

export async function bulkMarkPaid(ids: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // v1.4.14: same manual-confirmation stamp as markPaid — see comment there.
  const { error } = await supabase
    .from("invoices")
    .update({
      status: "paid",
      payment_confirmation_method: "manual",
      paid_at: new Date().toISOString(),
    })
    .eq("user_id", user!.id)
    .in("id", ids);

  if (error) throw new Error(error.message);
  revalidatePath("/invoices");
}
