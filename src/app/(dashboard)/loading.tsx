export default function Loading() {
  return (
    <div
      id="dashboard-loading"
      className="flex min-h-[40vh] items-center justify-center p-8"
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      <span className="sr-only">Loading dashboard</span>
    </div>
  );
}
