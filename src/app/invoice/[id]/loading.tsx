export default function Loading() {
  return (
    <div
      id="invoice-loading"
      className="flex min-h-[60vh] items-center justify-center p-8"
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      <span className="sr-only">Loading invoice</span>
    </div>
  );
}
