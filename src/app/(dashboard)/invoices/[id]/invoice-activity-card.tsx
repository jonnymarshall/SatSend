import { format } from "date-fns";
import {
  Mail,
  MailCheck,
  MailX,
  MailWarning,
  AlertCircle,
  Send,
  CheckCircle,
  Clock,
  RotateCcw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type EmailType = "invoice_published" | "payment_detected" | "payment_confirmed";
type EmailEventStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"
  | "skipped_no_api_key";
type InvoiceEventType =
  | "marked_as_sent"
  | "marked_as_paid"
  | "marked_as_overdue"
  | "marked_as_unpaid";

interface EmailEventRow {
  id: string;
  email_type: EmailType;
  recipient: string;
  status: EmailEventStatus;
  error_message: string | null;
  created_at: string;
}

interface InvoiceEventRow {
  id: string;
  event_type: InvoiceEventType;
  created_at: string;
}

type FeedRow =
  | { kind: "email"; data: EmailEventRow }
  | { kind: "manual"; data: InvoiceEventRow };

const EMAIL_TYPE_LABEL: Record<EmailType, string> = {
  invoice_published: "Invoice published",
  payment_detected: "Payment detected",
  payment_confirmed: "Payment confirmed",
};

const MANUAL_EVENT_LABEL: Record<InvoiceEventType, string> = {
  marked_as_sent: "Marked as sent",
  marked_as_paid: "Marked as paid",
  marked_as_overdue: "Marked as overdue",
  marked_as_unpaid: "Marked as unpaid",
};

const ICON_CLASS = "h-4 w-4 shrink-0";

function emailIcon(status: EmailEventStatus) {
  if (status === "failed") {
    return <AlertCircle data-icon="alert-circle" className={`${ICON_CLASS} text-red-600 dark:text-red-400`} />;
  }
  if (status === "delivered") {
    return <MailCheck data-icon="mail-check" className={`${ICON_CLASS} text-green-600 dark:text-green-400`} />;
  }
  if (status === "bounced") {
    return <MailX data-icon="mail-x" className={`${ICON_CLASS} text-red-600 dark:text-red-400`} />;
  }
  if (status === "complained") {
    return <MailWarning data-icon="mail-warning" className={`${ICON_CLASS} text-orange-600 dark:text-orange-400`} />;
  }
  return <Mail data-icon="mail" className={`${ICON_CLASS} text-muted-foreground`} />;
}

function manualIcon(type: InvoiceEventType) {
  switch (type) {
    case "marked_as_sent":
      return <Send data-icon="send" className={`${ICON_CLASS} text-muted-foreground`} />;
    case "marked_as_paid":
      return <CheckCircle data-icon="check-circle" className={`${ICON_CLASS} text-green-600 dark:text-green-400`} />;
    case "marked_as_overdue":
      return <Clock data-icon="clock" className={`${ICON_CLASS} text-red-600 dark:text-red-400`} />;
    case "marked_as_unpaid":
      return <RotateCcw data-icon="rotate-ccw" className={`${ICON_CLASS} text-muted-foreground`} />;
  }
}

function emailLabel(evt: EmailEventRow): string {
  const base = EMAIL_TYPE_LABEL[evt.email_type];
  switch (evt.status) {
    case "failed":
      return `${base} failed`;
    case "skipped_no_api_key":
      return `${base} skipped`;
    case "sent":
      return `${base} · awaiting delivery`;
    case "delivered":
      return `${base} · delivered`;
    case "bounced":
      return `${base} · bounced`;
    case "complained":
      return `${base} · marked as spam`;
    default:
      return base;
  }
}

export async function InvoiceActivityCard({ invoiceId }: { invoiceId: string }) {
  const supabase = await createClient();

  const [emailRes, manualRes] = await Promise.all([
    supabase
      .from("email_events")
      .select("id, email_type, recipient, status, error_message, created_at")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoice_events")
      .select("id, event_type, created_at")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false }),
  ]);

  const emails = (emailRes.data ?? []) as EmailEventRow[];
  const manuals = (manualRes.data ?? []) as InvoiceEventRow[];

  if (emails.length === 0 && manuals.length === 0) return null;

  const rows: FeedRow[] = [
    ...emails.map((e) => ({ kind: "email", data: e } as FeedRow)),
    ...manuals.map((m) => ({ kind: "manual", data: m } as FeedRow)),
  ].sort((a, b) => b.data.created_at.localeCompare(a.data.created_at));

  return (
    <section id="invoice-detail--activity" className="space-y-3">
      <h2
        id="invoice-detail--activity-heading"
        className="text-xs font-semibold text-muted-foreground uppercase tracking-widest"
      >
        Activity
      </h2>
      <ul
        id="invoice-detail--activity-list"
        className="rounded-lg border border-border"
      >
        {rows.map((row) => {
          const ts = format(new Date(row.data.created_at), "MMM d, h:mm a");
          if (row.kind === "email") {
            const evt = row.data;
            return (
              <li
                key={`email-${evt.id}`}
                className="proxy-id--invoice-detail--activity-row flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                {emailIcon(evt.status)}
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="font-medium">{emailLabel(evt)}</span>
                    {evt.recipient && (
                      <span className="text-muted-foreground"> — {evt.recipient}</span>
                    )}
                  </p>
                  {(evt.status === "failed" || evt.status === "bounced") && evt.error_message && (
                    <p className="proxy-id--invoice-detail--activity-error text-xs text-red-600 dark:text-red-400 break-words">
                      {evt.error_message}
                    </p>
                  )}
                </div>
                <time
                  dateTime={evt.created_at}
                  title={evt.created_at}
                  className="text-xs text-muted-foreground tabular-nums shrink-0"
                >
                  {ts}
                </time>
              </li>
            );
          }
          const evt = row.data;
          return (
            <li
              key={`manual-${evt.id}`}
              className="proxy-id--invoice-detail--activity-row flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              {manualIcon(evt.event_type)}
              <p className="min-w-0 flex-1 truncate font-medium">
                {MANUAL_EVENT_LABEL[evt.event_type]}
              </p>
              <time
                dateTime={evt.created_at}
                title={evt.created_at}
                className="text-xs text-muted-foreground tabular-nums shrink-0"
              >
                {ts}
              </time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
