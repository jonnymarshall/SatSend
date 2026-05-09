"use client";

import { useRouter } from "next/navigation";

export function BackToInvoices() {
  const router = useRouter();
  // history.length > 1 means the user has prior history in this tab; using
  // back() preserves any ?page=N state on /invoices. Falls back to /invoices
  // for deep-link arrivals (paste URL, email, new tab) where there's nowhere
  // to go back to.
  const handleClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/invoices");
    }
  };

  return (
    <button
      id="invoice-detail--back-link"
      type="button"
      onClick={handleClick}
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      ← Invoices
    </button>
  );
}
