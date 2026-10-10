"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button, buttonVariants } from "@/components/signal/button";
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
} from "../actions";
import { bulkArchive, bulkDelete, bulkUnarchive } from "../bulk-actions";
import type { Database } from "@/lib/database.types";

interface Invoice {
  id: string;
  status: Database["public"]["Enums"]["invoice_status"];
  due_date?: string | null;
  client_email?: string | null;
  sent_at?: string | null;
  send_method?: string | null;
  email_attempted_at?: string | null;
}

export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isDraft = invoice.status === "draft";
  const isArchived = invoice.status === "archived";
  const canShowMarkAsMenu = !isDraft && !isArchived;
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
    } catch {
      setError("Something went wrong. Please try again.");
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
    <div id="invoice-actions" className="space-y-3">
      {error && (
        <div
          id="invoice-actions--error"
          role="alert"
          className="rounded-(--radius-md) border border-(--color-danger)/30 bg-(--color-danger-soft) px-4 py-3 text-sm text-(--color-danger-text)"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          id="invoice-actions--notice"
          role="status"
          className="rounded-(--radius-md) border border-(--color-success)/30 bg-(--color-success-soft) px-4 py-3 text-sm text-(--color-success-text)"
        >
          {notice}
        </div>
      )}
      {deliveryLine && (
        <p id="invoice-actions--delivery-status" className="text-sm text-(--color-text-secondary)">
          {deliveryLine}
        </p>
      )}
      <div id="invoice-actions--buttons" className="flex flex-wrap gap-2 sm:gap-3">
        {isDraft && (
          <Link
            id="invoice-actions--edit-draft-button"
            href={`/invoices/${invoice.id}/edit`}
            className={buttonVariants({ variant: "secondary" })}
          >
            Edit draft
          </Link>
        )}

        {!isDraft && (
          <Link
            id="invoice-actions--view-public-button"
            href={`/invoice/${invoice.id}`}
            target="_blank"
            className={buttonVariants({ variant: "secondary" })}
          >
            View public invoice
          </Link>
        )}

        {!isDraft && (
          <a
            id="invoice-actions--download-pdf-button"
            href={`/api/invoices/${invoice.id}/pdf`}
            download
            className={buttonVariants({ variant: "secondary" })}
          >
            Download PDF
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
                if (!result.ok) {
                  setError(result.message);
                  return;
                }
                const { emailStatus } = result.data;
                if (emailStatus === "sent") {
                  setNotice(
                    invoice.client_email
                      ? `Email queued for delivery to ${invoice.client_email}. See the Email Activity log for the delivery status.`
                      : "Email queued for delivery. See the Email Activity log for the delivery status."
                  );
                } else if (emailStatus === "failed") {
                  setError(
                    "Email delivery failed at the provider. The invoice has been published; see the Email Activity log for the error message."
                  );
                } else if (emailStatus === "skipped_no_api_key") {
                  setError(
                    "Email skipped: the email provider isn't configured (RESEND_API_KEY is missing). The invoice has been published — use 'Mark as sent' to record manual delivery."
                  );
                } else if (emailStatus === "no_recipient") {
                  setError(
                    "Email skipped: no client email is set on this invoice. The invoice has been published — use 'Mark as sent' to record manual delivery."
                  );
                } else if (emailStatus === "skipped_daily_cap") {
                  setError(
                    "Daily email limit reached for your account (200 emails in 24 hours). The invoice has been published — try again later, or use 'Mark as sent' to record manual delivery."
                  );
                }
              })
            }
            onMarkSent={(id) =>
              run(async () => {
                const res = await publishAndMarkSent(id);
                if (!res.ok) setError(res.message);
              })
            }
            onDownloadAndMarkSent={(id) =>
              run(async () => {
                const result = await publishAndMarkSent(id, { withDownload: true });
                if (!result.ok) {
                  setError(result.message);
                  return;
                }
                if (result.data.downloadUrl && typeof window !== "undefined") {
                  window.location.href = result.data.downloadUrl;
                }
              })
            }
            onPublishOnly={(id) =>
              run(async () => {
                const res = await publishInvoice(id);
                if (!res.ok) setError(res.message);
              })
            }
          />
        )}

        {canShowMarkAsMenu && (
          <MarkAsMenu
            invoiceId={invoice.id}
            status={invoice.status}
            dueDate={invoice.due_date ?? null}
            busy={busy}
            onMarkPaid={(id) => run(() => markPaid(id))}
            onMarkUnpaid={(id) => run(() => markUnpaid(id))}
            onMarkOverdue={(id) => run(() => markOverdue(id))}
          />
        )}

        {isArchived && (
          <Button
            id="invoice-actions--unarchive-button"
            variant="secondary"
            onClick={() =>
              run(async () => {
                const { unarchived } = await bulkUnarchive([invoice.id]);
                if (unarchived === 0) {
                  setError(
                    "This invoice can't be unarchived automatically because its previous status wasn't recorded. Use the Mark as menu to set its status."
                  );
                }
              })
            }
            disabled={busy}
          >
            Unarchive
          </Button>
        )}
        {!isArchived && !isDraft && (
          <Button
            id="invoice-actions--archive-button"
            variant="secondary"
            onClick={() => run(() => bulkArchive([invoice.id]))}
            disabled={busy}
          >
            Archive
          </Button>
        )}

        <Button
          id="invoice-actions--duplicate-button"
          variant="secondary"
          onClick={() => run(() => duplicateInvoice(invoice.id))}
          disabled={busy}
        >
          Duplicate
        </Button>

        <Button
          id="invoice-actions--delete-button"
          variant="danger"
          onClick={handleDelete}
          disabled={busy}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
