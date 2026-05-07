"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { PublishMenu } from "@/components/publish-menu";
import { MarkAsMenu } from "@/components/mark-as-menu";
import {
  deleteDraft,
  duplicateInvoice,
  markOverdue,
  markPaid,
  markUnpaid,
  publishInvoice,
  publishAndSendEmail,
  publishAndMarkSent,
  confirmMarkedAsPaid,
  disputeMarkedAsPaid,
} from "../actions";
import { bulkArchive, bulkDelete, bulkUnarchive } from "../bulk-actions";
import { parseServerError } from "@/lib/invoices";

interface Invoice {
  id: string;
  status: string;
  due_date?: string | null;
  client_email?: string | null;
  sent_at?: string | null;
  send_method?: "email" | "manual" | null;
  email_attempted_at?: string | null;
  payment_confirmation_method?: "onchain" | "manual" | null;
}

export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isDraft = invoice.status === "draft";
  const isArchived = invoice.status === "archived";
  const isMarkedAsPaid = invoice.status === "marked_as_paid";
  // When awaiting owner confirmation, the dedicated Confirm/Dispute buttons
  // take over — the generic Mark As menu would just confuse the action set.
  const canShowMarkAsMenu = !isDraft && !isArchived && !isMarkedAsPaid;
  // Hide the publish/send trigger only when truly nothing remains to do — i.e., the invoice
  // has both been marked sent AND had an email attempt. Until then keep the menu reachable
  // (even with no client_email — the "Send via email" item explains via tooltip).
  const allSendActionsDone = !!invoice.sent_at && !!invoice.email_attempted_at;
  const canShowPublishMenu = isDraft || (!isArchived && !allSendActionsDone);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(parseServerError((e as Error).message).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (isDraft) {
      await run(async () => {
        await deleteDraft(invoice.id);
        router.push("/invoices");
      });
    } else {
      await run(async () => {
        await bulkDelete([invoice.id]);
        router.push("/invoices");
      });
    }
  }

  const deliveryLine =
    invoice.sent_at && invoice.send_method
      ? invoice.send_method === "email"
        ? `Sent via email on ${format(new Date(invoice.sent_at), "MMM d, yyyy")}`
        : `Marked as sent on ${format(new Date(invoice.sent_at), "MMM d, yyyy")}`
      : null;

  return (
    <div id="invoice-actions" className="space-y-3 pb-8">
      {error && (
        <div
          id="invoice-actions--error"
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          id="invoice-actions--notice"
          role="status"
          className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400"
        >
          {notice}
        </div>
      )}
      {deliveryLine && (
        <p id="invoice-actions--delivery-status" className="text-sm text-muted-foreground">
          {deliveryLine}
        </p>
      )}
      <div id="invoice-actions--buttons" className="flex gap-3 flex-wrap">
        {isDraft && (
          <Link href={`/invoices/${invoice.id}/edit`}>
            <Button id="invoice-actions--edit-draft-button" variant="outline">Edit draft</Button>
          </Link>
        )}

        {!isDraft && (
          <Link href={`/invoice/${invoice.id}`} target="_blank">
            <Button id="invoice-actions--view-public-button" variant="outline">View public invoice</Button>
          </Link>
        )}

        {!isDraft && (
          <a href={`/api/invoices/${invoice.id}/pdf`} download>
            <Button id="invoice-actions--download-pdf-button" variant="outline">Download PDF</Button>
          </a>
        )}

        {canShowPublishMenu && (
          <PublishMenu
            invoiceId={invoice.id}
            isDraft={isDraft}
            emailAttemptedAt={invoice.email_attempted_at ?? null}
            clientEmail={invoice.client_email ?? null}
            sentAt={invoice.sent_at ?? null}
            sendMethod={invoice.send_method ?? null}
            busy={busy}
            onSendEmail={(id) =>
              run(async () => {
                const result = await publishAndSendEmail(id);
                if (result.emailStatus === "sent") {
                  setNotice(
                    invoice.client_email
                      ? `Email queued for delivery to ${invoice.client_email}. See the Email Activity log for the delivery status.`
                      : "Email queued for delivery. See the Email Activity log for the delivery status."
                  );
                } else if (result.emailStatus === "failed") {
                  setError(
                    "Email delivery failed at the provider. The invoice has been published; see the Email Activity log for the error message."
                  );
                } else if (result.emailStatus === "skipped_no_api_key") {
                  setError(
                    "Email skipped: the email provider isn't configured (RESEND_API_KEY is missing). The invoice has been published — use 'Mark as sent' to record manual delivery."
                  );
                } else if (result.emailStatus === "no_recipient") {
                  setError(
                    "Email skipped: no client email is set on this invoice. The invoice has been published — use 'Mark as sent' to record manual delivery."
                  );
                }
              })
            }
            onMarkSent={(id) => run(() => publishAndMarkSent(id))}
            onDownloadAndMarkSent={(id) =>
              run(async () => {
                const result = await publishAndMarkSent(id, { withDownload: true });
                if (result?.downloadUrl && typeof window !== "undefined") {
                  window.location.href = result.downloadUrl;
                }
              })
            }
            onPublishOnly={(id) => run(() => publishInvoice(id))}
          />
        )}

        {canShowMarkAsMenu && (
          <MarkAsMenu
            invoiceId={invoice.id}
            status={invoice.status}
            dueDate={invoice.due_date ?? null}
            paymentConfirmationMethod={invoice.payment_confirmation_method ?? null}
            busy={busy}
            onMarkPaid={(id) => run(() => markPaid(id))}
            onMarkUnpaid={(id) => run(() => markUnpaid(id))}
            onMarkOverdue={(id) => run(() => markOverdue(id))}
          />
        )}

        {isMarkedAsPaid && (
          <>
            <Button
              id="invoice-actions--confirm-marked-as-paid-button"
              onClick={() => run(() => confirmMarkedAsPaid(invoice.id))}
              disabled={busy}
            >
              Confirm payment received
            </Button>
            <Button
              id="invoice-actions--dispute-marked-as-paid-button"
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => run(() => disputeMarkedAsPaid(invoice.id))}
              disabled={busy}
            >
              Dispute / revert
            </Button>
          </>
        )}

        {isArchived && (
          <Button
            id="invoice-actions--unarchive-button"
            variant="outline"
            onClick={() => run(() => bulkUnarchive([invoice.id]))}
            disabled={busy}
          >
            Unarchive
          </Button>
        )}
        {!isArchived && !isDraft && (
          <Button
            id="invoice-actions--archive-button"
            variant="outline"
            onClick={() => run(() => bulkArchive([invoice.id]))}
            disabled={busy}
          >
            Archive
          </Button>
        )}

        <Button
          id="invoice-actions--duplicate-button"
          variant="outline"
          onClick={() => run(() => duplicateInvoice(invoice.id))}
          disabled={busy}
        >
          Duplicate
        </Button>

        <Button
          id="invoice-actions--delete-button"
          variant="outline"
          className="text-primary border-primary/30 hover:bg-primary/10"
          onClick={handleDelete}
          disabled={busy}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
