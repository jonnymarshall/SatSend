"use client";

import { useRouter } from "next/navigation";

export function BackToInvoices() {
  const router = useRouter();
  // Same-origin document.referrer means the user clicked a link from our app
  // to get here — back() will return them to where they came from with the
  // ?page=N state intact. window.history.length isn't reliable: Next.js
  // prefetching and router internals can bump it without there being an
  // actual user-visible page behind the current one, leaving back() a no-op.
  const handleClick = () => {
    if (typeof document !== "undefined" && document.referrer) {
      try {
        const ref = new URL(document.referrer);
        if (ref.origin === window.location.origin) {
          router.back();
          return;
        }
      } catch {
        // malformed referrer — fall through to push
      }
    }
    router.push("/invoices");
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
