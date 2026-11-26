import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "@/components/invoice-form";
import { duplicateFormValues } from "@/lib/invoices/duplicate";
import { findOwnInvoice } from "@/lib/invoices/own-invoice";
import { DEFAULT_CURRENCY } from "@/lib/currencies";

// v1.5.34 (roadmap v1.4.25): Duplicate opens this page with ?from=<id>, filled
// in from the original. Nothing is saved until the sender saves, so cancelling
// leaves no stray draft.
export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  // R-44: a new invoice starts in the currency of your most recent one.
  const { data: last } = await supabase
    .from("invoices")
    .select("currency")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const defaultCurrency = last?.currency ?? DEFAULT_CURRENCY;

  let initialValues: ReturnType<typeof duplicateFormValues> | undefined;
  let copiedFrom: string | null = null;
  if (from) {
    // Only the signed-in sender's own invoice (RLS also enforces this).
    // v1.5.38: ?from= is the SatSend reference (an old UUID still works).
    const source = (await findOwnInvoice(supabase, user.id, from))?.invoice;
    if (!source) notFound();

    const { data: takenRows } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("user_id", user.id)
      .not("invoice_number", "is", null);
    const taken = new Set((takenRows ?? []).map((r) => r.invoice_number as string));

    initialValues = duplicateFormValues(source, taken);
    copiedFrom = source.invoice_number || "an invoice without a number";
  }

  return (
    <div id="invoice-form-page" className="space-y-6">
      <div id="invoice-form-page--header" className="space-y-1">
        <h1 id="invoice-form-page--heading" className="font-display tracking-heading text-[28px] leading-tight font-bold md:text-[32px]">New Invoice</h1>
        {copiedFrom && (
          <p id="invoice-form-page--copied-from" className="text-[15px] text-(--color-text-secondary)">
            A copy of {copiedFrom}. Nothing is saved until you save it.
          </p>
        )}
      </div>
      {initialValues ? (
        <InvoiceForm sessionEmail={user.email} initialValues={initialValues} defaultCurrency={defaultCurrency} />
      ) : (
        <InvoiceForm sessionEmail={user.email} defaultCurrency={defaultCurrency} />
      )}
    </div>
  );
}
