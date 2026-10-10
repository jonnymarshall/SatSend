import { Spinner } from "@/components/signal/spinner";

export default function Loading() {
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
