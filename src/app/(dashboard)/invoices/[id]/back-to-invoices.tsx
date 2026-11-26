"use client";

import { useRouter } from "next/navigation";
import { invoiceListUrl } from "@/lib/invoices/list-return";

// R-63 (release 1.6.1): always opens the invoice list, on the page you were on.
// Never the browser's back: after saving a draft, that's the edit form.
export function BackToInvoices() {
  const router = useRouter();

  return (
    <button
      id="invoice-detail--back-link"
      type="button"
      onClick={() => router.push(invoiceListUrl())}
      className="-mx-2 inline-flex min-h-11 items-center rounded-(--radius-sm) px-2 text-sm font-medium text-(--color-text-secondary) hover:bg-(--color-neutral-soft) hover:text-(--color-ink) md:min-h-9"
    >
      ← Invoices
    </button>
  );
}
