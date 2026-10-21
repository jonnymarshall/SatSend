import { format } from "date-fns";

/**
 * The dates at the top of an invoice (v1.5.19). The sent date is the day it was
 * first sent (`sent_at`), never the day the draft was created: the owner sees
 * "Date Sent", the client "Invoice date". A draft hasn't been sent, so it shows
 * no such line.
 */
interface Props {
  audience: "owner" | "client";
  sentAt: string | null;
  dueDate: string | null;
}

export function InvoiceDates({ audience, sentAt, dueDate }: Props) {
  return (
    <div id="invoice-dates" className="space-y-0.5 text-sm text-(--color-text-secondary)">
      {sentAt ? (
        <p id="invoice-dates--sent">
          <span className="font-medium text-(--color-ink)">{audience === "client" ? "Invoice date:" : "Date Sent:"}</span>{" "}
          {format(new Date(sentAt), "MMMM d, yyyy")}
        </p>
      ) : null}
      <p id="invoice-dates--due">
        <span className="font-medium text-(--color-ink)">Date Due:</span>{" "}
        {dueDate ? format(new Date(dueDate + "T12:00:00"), "MMMM d, yyyy") : "No due date"}
      </p>
    </div>
  );
}
