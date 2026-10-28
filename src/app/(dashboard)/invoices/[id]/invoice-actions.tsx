"use client";

import { useRouter } from "next/navigation";
import { pdfHref, useTimeZone } from "@/lib/use-time-zone";
import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button, buttonVariants } from "@/components/signal/button";
import { SendMenu } from "@/components/send-menu";
import { showNotice } from "@/components/notice";
import { deferredCopy } from "@/lib/copy-when-ready";
import { clientInvoiceUrl, emailOutcomeMessage } from "@/lib/invoices/send-feedback";
import { MarkAsMenu } from "@/components/mark-as-menu";
import {
  deleteDraft,
  duplicateInvoice,
  markOverdue,
  markPaid,
  markUnpaid,
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
  btc_txid?: string | null;
}

export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const timeZone = useTimeZone();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isDraft = invoice.status === "draft";
  const isArchived = invoice.status === "archived";
  const canShowMarkAsMenu = !isDraft && !isArchived;
  // Hide the Send menu only when truly nothing remains to do: the invoice has
  // been sent AND had an email attempt. Until then keep it reachable (even with
  // no client_email; the "Send now via email" item explains via tooltip).
  const allSendActionsDone = !!invoice.sent_at && !!invoice.email_attempted_at;
  const canShowSendMenu = isDraft || (!isArchived && !allSendActionsDone);

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
            href={pdfHref(`/api/invoices/${invoice.id}/pdf`, timeZone)}
            download
            className={buttonVariants({ variant: "secondary" })}
          >
            Download PDF
          </a>
        )}

        {canShowSendMenu && (
          <SendMenu
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
                const message = emailOutcomeMessage(result.data.emailStatus, {
                  wasDraft: isDraft,
                  clientEmail: invoice.client_email,
                });
                if (message.tone === "notice") setNotice(message.text);
                else setError(message.text);
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
            onCopyLinkAndMarkSent={(id) => {
              // Start the copy inside the click (Safari); the link is supplied
              // only if marking as sent succeeds.
              const copy = deferredCopy();
              void run(async () => {
                const res = await publishAndMarkSent(id).catch((e) => {
                  copy.provide(null);
                  throw e;
                });
                if (!res.ok) {
                  copy.provide(null);
                  setError(res.message);
                  return;
                }
                copy.provide(clientInvoiceUrl(id, window.location.origin));
                showNotice((await copy.copied) ? "Link copied" : "Marked as sent. Copy the link from View public invoice.");
              });
            }}
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
            paidOnChain={!!invoice.btc_txid}
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
