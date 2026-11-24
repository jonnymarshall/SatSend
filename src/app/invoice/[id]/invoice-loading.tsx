import { Spinner } from "@/components/signal/spinner";

/** The spinner shown while the bitcoin price loads (v1.5.30: no longer a route-level loading.tsx, which forced a 200 on unknown links). */
export function InvoiceLoading() {
  return (
    <div
      id="invoice-loading"
      className="flex min-h-[60vh] items-center justify-center p-8"
      role="status"
      aria-live="polite"
    >
      <Spinner />
      <span className="sr-only">Loading invoice</span>
    </div>
  );
}
