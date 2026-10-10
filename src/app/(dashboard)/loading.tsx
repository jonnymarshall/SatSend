import { Spinner } from "@/components/signal/spinner";

export default function Loading() {
  return (
    <div
      id="dashboard-loading"
      className="flex min-h-[40vh] items-center justify-center p-8"
      role="status"
      aria-live="polite"
    >
      <Spinner />
      <span className="sr-only">Loading dashboard</span>
    </div>
  );
}
