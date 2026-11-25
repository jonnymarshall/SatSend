"use client";

import { useRouter } from "next/navigation";
import { pdfHref, useTimeZone } from "@/lib/use-time-zone";
import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/signal/button";
import { SendMenu } from "@/components/send-menu";
import { showNotice } from "@/components/notice";
import { deferredCopy } from "@/lib/copy-when-ready";
import { clientInvoiceUrl, emailOutcomeMessage } from "@/lib/invoices/send-feedback";
import { MarkAsMenu } from "@/components/mark-as-menu";
import {
  deleteDraft,
  markOverdue,
  markPaid,
  markUnpaid,
  publishAndSendEmail,
  publishAndMarkSent,
} from "../actions";
import { bulkArchive, bulkUnarchive } from "../bulk-actions";
import { deleteAvailability } from "@/lib/invoices/action-availability";
import type { Database } from "@/lib/database.types";
import { publicInvoicePath } from "@/lib/invoices/reference";

interface Invoice {
  id: string;
  /** The SatSend reference (v1.5.31), for the client's link. */
  reference: string;
  status: Database["public"]["Enums"]["invoice_status"];
  due_date?: string | null;
  client_email?: string | null;
  /** v1.5.37: a draft without a valid one can't be sent. */
  btc_address?: string | null;
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

  // v1.5.37 (roadmap v1.4.24): only drafts can be deleted. A non-draft used to
  // go through bulkDelete, which skipped it, then back to the list as if gone.
  const canDelete = deleteAvailability(invoice);
  async function handleDelete() {
    if (!canDelete.ok) return;
    await run(async () => {
      await deleteDraft(invoice.id);
      router.push("/invoices");
    });
  }

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
      {/* v1.5.35 (roadmap v1.4.22): no "Sent via email on …" line here; the
          activity feed's "Invoice sent" / "Marked as sent" entry says it. */}
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
            href={publicInvoicePath(invoice)}
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
            btcAddress={invoice.btc_address ?? null}
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
                copy.provide(clientInvoiceUrl(res.data, window.location.origin));
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

        {/* v1.5.34: opens a pre-filled New Invoice form; nothing is saved. */}
        <Link
          id="invoice-actions--duplicate-button"
          href={`/invoices/new?from=${invoice.id}`}
          className={buttonVariants({ variant: "secondary" })}
        >
          Duplicate
        </Link>

        {/* v1.5.37: a disabled button ignores the mouse, so the hover reason
            sits on this wrapper. */}
        <span id="invoice-actions--delete-wrapper" className="inline-flex" title={canDelete.ok ? undefined : canDelete.reason}>
          <Button
            id="invoice-actions--delete-button"
            variant="danger"
            onClick={handleDelete}
            disabled={busy || !canDelete.ok}
          >
            Delete
          </Button>
        </span>
      </div>
    </div>
  );
}
