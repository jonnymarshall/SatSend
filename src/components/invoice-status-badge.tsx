const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:             { label: "Draft",             className: "bg-muted text-muted-foreground" },
  pending:           { label: "Pending",           className: "bg-yellow-500/15 text-yellow-400" },
  payment_detected:  { label: "Payment Detected",  className: "bg-blue-500/15 text-blue-400" },
  marked_as_paid:    { label: "Awaiting Confirmation", className: "bg-purple-500/15 text-purple-400" },
  paid:              { label: "Paid",              className: "bg-green-500/15 text-green-400" },
  overdue:           { label: "Overdue",           className: "bg-destructive/15 text-destructive" },
  archived:          { label: "Archived",          className: "bg-muted/50 text-muted-foreground/60" },
};

export function InvoiceStatusBadge({ status, id }: { status: string; id?: string }) {
  const { label, className } = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      id={id}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
