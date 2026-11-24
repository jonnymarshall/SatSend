import { format } from "date-fns";
import { REFERENCE_LABEL, formatReference } from "@/lib/invoices/reference";

/**
 * The dates at the top of an invoice (v1.5.19). The sent date is the day it was
 * first sent (`sent_at`), never the day the draft was created: the owner sees
 * "Date Sent", the client "Invoice date". A draft hasn't been sent, so it shows
 * no such line. v1.5.31: the SatSend reference sits first, as a row in the
 * same style.
 */
interface Props {
  audience: "owner" | "client";
  reference?: string;
  sentAt: string | null;
  dueDate: string | null;
}

export function InvoiceDates({ audience, reference, sentAt, dueDate }: Props) {
  return (
    <div id="invoice-dates" className="space-y-0.5 text-sm text-(--color-text-secondary)">
      {reference ? (
        <p id="invoice-dates--reference">
          <span className="font-medium text-(--color-ink)">{REFERENCE_LABEL}:</span>{" "}
          {formatReference(reference)}
        </p>
      ) : null}
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
