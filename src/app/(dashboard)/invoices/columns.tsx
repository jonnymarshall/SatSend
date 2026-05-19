"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Mail, HandHelping, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import { canMarkAsOverdue, canMarkAsPending } from "@/lib/invoices/overdue-actions";

export interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  client_name: string | null;
  client_email: string | null;
  total_fiat: number;
  currency: string;
  status: string;
  due_date: string | null;
  created_at: string;
  sent_at: string | null;
  send_method: "email" | "manual" | null;
  email_attempted_at: string | null;
  last_publish_email_status:
    | "queued"
    | "sent"
    | "delivered"
    | "bounced"
    | "complained"
    | "failed"
    | "skipped_no_api_key"
    | null;
  last_publish_email_error: string | null;
}

export interface RowActions {
  onPublishOnly: (id: string) => void;
  onSendEmail: (id: string) => void;
  onMarkSent: (id: string) => void;
  onDownloadAndMarkSent: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onMarkOverdue: (id: string) => void;
  onMarkPending: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyPublicLink: (id: string) => void;
  onDuplicate: (id: string) => void;
}

function sortableHeader(label: string) {
  return ({ column }: { column: { toggleSorting: (desc: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) => (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      className="-ml-3 h-8"
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

export function buildColumns(actions: RowActions): ColumnDef<InvoiceRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "invoice_number",
      header: sortableHeader("Invoice"),
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <Link
            href={`/invoices/${invoice.id}`}
            className="font-medium hover:underline"
          >
            {invoice.invoice_number || "—"}
          </Link>
        );
      },
    },
    {
      accessorKey: "client_name",
      header: sortableHeader("Client"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.client_name || "—"}
        </span>
      ),
    },
    {
      accessorKey: "created_at",
      header: sortableHeader("Date Sent"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {format(new Date(row.original.created_at), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "due_date",
      header: sortableHeader("Date Due"),
      cell: ({ row }) => {
        const d = row.original.due_date;
        return (
          <span className="text-muted-foreground">
            {d ? format(new Date(d + "T12:00:00"), "MMM d, yyyy") : "—"}
          </span>
        );
      },
    },
    {
      accessorKey: "total_fiat",
      header: ({ column }) => (
        <div className="text-right">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-mr-3 h-8"
          >
            Amount
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => {
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: row.original.currency,
        }).format(row.original.total_fiat);
        return <div className="text-right font-medium">{formatted}</div>;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const r = row.original;
        // A failed / bounced / spam-complaint outcome takes precedence over
        // the sent-method icon: those rows show only the failure indicator,
        // never both icons stacked together. v1.4.18 added the bounced and
        // complained statuses, which Resend reports post-acceptance via
        // webhook.
        const failureLabel =
          r.last_publish_email_status === "failed"
            ? "Email failed to send to this client"
            : r.last_publish_email_status === "bounced"
              ? "Email bounced"
              : r.last_publish_email_status === "complained"
                ? "Email marked as spam"
                : null;
        const trailingIcon = failureLabel ? (
          <AlertCircle
            className="proxy-id--invoice-row--email-failed-indicator h-3.5 w-3.5 text-destructive"
            aria-label={failureLabel}
          >
            <title>{failureLabel}</title>
          </AlertCircle>
        ) : r.send_method === "email" ? (
          <Mail
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-label="Sent via email"
          >
            <title>Sent via email</title>
          </Mail>
        ) : r.send_method === "manual" ? (
          <HandHelping
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-label="Marked as sent manually"
          >
            <title>Marked as sent manually</title>
          </HandHelping>
        ) : null;
        return (
          <div className="flex items-center gap-1.5">
            <InvoiceStatusBadge status={r.status} />
            {trailingIcon}
          </div>
        );
      },
      filterFn: (row, columnId, filterValue: string[]) => {
        if (!filterValue || filterValue.length === 0) return true;
        return filterValue.includes(row.getValue(columnId) as string);
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const invoice = row.original;
        const isDraft = invoice.status === "draft";
        const isArchived = invoice.status === "archived";
        // Hide the publish/send menu only when truly nothing remains to do — i.e., the invoice
        // has both been marked sent AND had an email attempt. Manual-mark-sent (without email)
        // leaves email_attempted_at NULL, so "Send now via email" must still be reachable.
        const allSendActionsDone = !!invoice.sent_at && !!invoice.email_attempted_at;
        const showPublishMenu = isDraft || (!isArchived && !allSendActionsDone);
        const emailDisabled = !!invoice.email_attempted_at || !invoice.client_email;
        const emailDisabledReason = invoice.email_attempted_at
          ? "An email has already been attempted for this invoice; multiple sends are not supported."
          : !invoice.client_email
          ? "No client email on this invoice — cannot send."
          : undefined;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56 whitespace-nowrap">
              <DropdownMenuItem render={<Link href={`/invoices/${invoice.id}`}>View invoice</Link>} />
              {isDraft && (
                <DropdownMenuItem render={<Link href={`/invoices/${invoice.id}/edit`}>Edit</Link>} />
              )}
              {!isDraft && (
                <>
                  <DropdownMenuItem render={<Link href={`/invoice/${invoice.id}`} target="_blank">View public invoice</Link>} />
                  <DropdownMenuItem onClick={() => actions.onCopyPublicLink(invoice.id)}>
                    Copy public link
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<a href={`/api/invoices/${invoice.id}/pdf`} download>Download PDF</a>} />
                </>
              )}
              {showPublishMenu && (
                <>
                  <DropdownMenuItem
                    disabled={emailDisabled}
                    title={emailDisabled ? emailDisabledReason : undefined}
                    onClick={() => !emailDisabled && actions.onSendEmail(invoice.id)}
                  >
                    Send now via email
                  </DropdownMenuItem>
                  {!invoice.sent_at && (
                    <>
                      <DropdownMenuItem onClick={() => actions.onDownloadAndMarkSent(invoice.id)}>
                        Download and mark as sent
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => actions.onMarkSent(invoice.id)}>
                        Mark as sent
                      </DropdownMenuItem>
                    </>
                  )}
                  {isDraft && (
                    <DropdownMenuItem onClick={() => actions.onPublishOnly(invoice.id)}>
                      Publish only (don&apos;t send yet)
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {invoice.status !== "paid" && !isDraft && (
                <DropdownMenuItem onClick={() => actions.onMarkPaid(invoice.id)}>
                  Mark as paid
                </DropdownMenuItem>
              )}
              {canMarkAsOverdue(invoice) && (
                <DropdownMenuItem onClick={() => actions.onMarkOverdue(invoice.id)}>
                  Mark as overdue
                </DropdownMenuItem>
              )}
              {canMarkAsPending(invoice) && (
                <DropdownMenuItem onClick={() => actions.onMarkPending(invoice.id)}>
                  Mark as pending
                </DropdownMenuItem>
              )}
              {isArchived && (
                <DropdownMenuItem onClick={() => actions.onUnarchive(invoice.id)}>
                  Unarchive
                </DropdownMenuItem>
              )}
              {!isArchived && !isDraft && (
                <DropdownMenuItem onClick={() => actions.onArchive(invoice.id)}>
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => actions.onDuplicate(invoice.id)}>
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => actions.onDelete(invoice.id)}
                className="text-destructive focus:text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
