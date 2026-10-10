import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/signal/button";
import { Card } from "@/components/signal/card";
import { InvoiceDataTable } from "./data-table";
import type { InvoiceRow } from "./columns";

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
      <div id="invoices-page--header" className="flex items-center justify-between gap-4">
        <h1 id="invoices-page--heading" className="font-display tracking-heading text-[28px] leading-tight font-bold md:text-[32px]">
          Invoices
        </h1>
        <Link
          id="invoices-page--new-invoice-link"
          href="/invoices/new"
          className={buttonVariants()}
        >
          New Invoice
        </Link>
      </div>

      {!invoices?.length ? (
        <Card id="invoices-page--empty-state" className="px-6 py-14 text-center md:py-16">
          <h2 id="invoices-page--empty-title" className="font-display tracking-heading text-xl font-semibold">
            No invoices yet
          </h2>
          <p id="invoices-page--empty-body" className="mx-auto mt-2 max-w-sm text-[15px] text-(--color-text-secondary)">
            Create an invoice, send the link, and get paid in bitcoin.
          </p>
          <Link
            id="invoices-page--create-first-link"
            href="/invoices/new"
            className={buttonVariants({ variant: "secondary", className: "mt-6" })}
          >
            Create your first invoice
          </Link>
        </Card>
      ) : (
        <Suspense fallback={null}>
          <InvoiceDataTable data={(invoices ?? []) as unknown as InvoiceRow[]} userId={user?.id ?? ""} />
        </Suspense>
      )}
    </div>
  );
}
