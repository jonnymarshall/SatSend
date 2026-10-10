import { format } from "date-fns";

interface Props {
  createdAt: string;
  dueDate: string | null;
}

export function InvoiceDates({ createdAt, dueDate }: Props) {
  return (
    <div id="invoice-dates" className="space-y-0.5 text-sm text-(--color-text-secondary)">
      <p id="invoice-dates--sent">
        <span className="font-medium text-(--color-ink)">Date Sent:</span>{" "}
        {format(new Date(createdAt), "MMMM d, yyyy")}
      </p>
      <p id="invoice-dates--due">
        <span className="font-medium text-(--color-ink)">Date Due:</span>{" "}
        {dueDate ? format(new Date(dueDate + "T12:00:00"), "MMMM d, yyyy") : "No due date"}
      </p>
    </div>
  );
}
