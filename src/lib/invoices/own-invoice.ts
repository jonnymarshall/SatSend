import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { parseInvoiceKey, referencePath } from "@/lib/invoices/reference";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

/**
 * v1.5.38: the signed-in sender's own invoice, from the link's last part: a
 * SatSend reference ("ss-7k3qx9ab", read leniently) or an old UUID. `canonical`
 * is false when the link isn't exactly "ss-<reference>", so the page can
 * redirect to that one form. Null when there's no such invoice of theirs.
 */
export async function findOwnInvoice(
  supabase: SupabaseClient<Database>,
  userId: string,
  param: string,
): Promise<{ invoice: Invoice; canonical: boolean } | null> {
  const key = parseInvoiceKey(param);
  if (!key) return null;
  const base = supabase.from("invoices").select("*").eq("user_id", userId);
  const { data: invoice } = await (key.kind === "id"
    ? base.eq("id", key.id)
    : base.eq("reference", key.reference)
  ).maybeSingle();
  if (!invoice) return null;
  return { invoice, canonical: param === referencePath(invoice.reference) };
}
