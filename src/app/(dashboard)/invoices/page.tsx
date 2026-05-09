import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDataTable } from "./data-table";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: invoices } = await supabase
    .from("invoice_email_summary")
    .select("*")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false });

  return (
    <div id="invoices-page" className="space-y-6">
      <div id="invoices-page--header" className="flex items-center justify-between">
        <h1 id="invoices-page--heading" className="text-2xl font-semibold">Invoices</h1>
        <Link
          id="invoices-page--new-invoice-link"
          href="/invoices/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          New Invoice
        </Link>
      </div>

      {!invoices?.length ? (
        <div id="invoices-page--empty-state" className="rounded-lg border border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">No invoices yet</p>
          <Link
            id="invoices-page--create-first-link"
            href="/invoices/new"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Create your first invoice
          </Link>
        </div>
      ) : (
        <Suspense fallback={null}>
          <InvoiceDataTable data={invoices} userId={user?.id ?? ""} />
        </Suspense>
      )}
    </div>
  );
}
