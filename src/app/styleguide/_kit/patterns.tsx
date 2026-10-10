import { Copy, FileText, MoreHorizontal, Plus } from "lucide-react";
import { BtcQrCode } from "@/components/btc-qr-code";
import { Button } from "@/components/signal/button";
import { Card } from "@/components/signal/card";
import {
  StatusBadge,
  type InvoiceStatus,
} from "@/components/signal/status-badge";
import { cn } from "@/lib/utils";

/*
 * Product compositions for the internal kit (v1.5.0-H). All figures are SAMPLE
 * DATA, labelled as such where they are shown. They are built only from the
 * Signal primitives so they show what real screens will look like.
 */

// BIP-173 test vector, used purely as an obviously-example address.
export const EXAMPLE_ADDRESS = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";

export function InvoiceListItem({
  idPrefix,
  title,
  client,
  date,
  fiat,
  btc,
  status,
  className,
}: {
  idPrefix: string;
  title: string;
  client: string;
  date: string;
  fiat: string;
  btc: string;
  status: InvoiceStatus;
  className?: string;
}) {
  return (
    <div
      id={`${idPrefix}--invoice-item`}
      className={cn(
        "flex items-center gap-4 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-4",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-(--radius-md) bg-(--color-brand-soft) text-(--color-brand-text) [&_svg]:size-5"
      >
        <FileText />
      </span>
      <div className="min-w-0 flex-1">
        <p
          id={`${idPrefix}--invoice-item--title`}
          className="truncate text-[15px] font-semibold"
        >
          {title}
        </p>
        <p className="truncate text-sm text-(--color-text-secondary)">
          {client}, {date}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 text-right">
        <p className="text-[15px] font-semibold tabular-nums">{fiat}</p>
        <p className="text-[13px] text-(--color-text-secondary) tabular-nums">
          {btc}
        </p>
        <StatusBadge
          status={status}
          id={`${idPrefix}--invoice-item--status`}
          className="mt-1"
        />
      </div>
      <Button
        id={`${idPrefix}--invoice-item--menu`}
        variant="ghost"
        size="icon"
        aria-label={`More actions for ${title}`}
        className="-mr-2"
      >
        <MoreHorizontal />
      </Button>
    </div>
  );
}

export function StatsCard({ idPrefix }: { idPrefix: string }) {
  return (
    <Card id={`${idPrefix}--stats`} className="flex flex-col gap-1">
      <p className="text-sm text-(--color-text-secondary)">Total received</p>
      <p className="font-display tracking-heading text-[36px] leading-[1.1] font-[700]">
        $12,480.00
      </p>
      <p className="text-sm text-(--color-text-secondary) tabular-nums">
        0.19840000 BTC, last 30 days
      </p>
    </Card>
  );
}

export function EmptyState({ idPrefix }: { idPrefix: string }) {
  return (
    <Card id={`${idPrefix}--empty`} className="flex flex-col items-start gap-4">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-(--radius-md) bg-(--color-neutral-soft) text-(--color-text-secondary) [&_svg]:size-5"
      >
        <FileText />
      </span>
      <div>
        <p
          id={`${idPrefix}--empty--title`}
          className="text-[17px] font-semibold"
        >
          No invoices yet
        </p>
        <p className="mt-1 max-w-[40ch] text-pretty text-[15px] leading-[1.55] text-(--color-text-secondary)">
          Create your first invoice and send your client a payment link.
        </p>
      </div>
      <Button id={`${idPrefix}--empty--create`}>
        <Plus />
        Create invoice
      </Button>
    </Card>
  );
}

const TABLE_ROWS: Array<{
  n: string;
  client: string;
  due: string;
  fiat: string;
  btc: string;
  status: InvoiceStatus;
}> = [
  {
    n: "INV-0042",
    client: "Acme Studio",
    due: "12 Oct 2026",
    fiat: "$2,500.00",
    btc: "0.03412 BTC",
    status: "paid",
  },
  {
    n: "INV-0043",
    client: "Bright Media",
    due: "18 Oct 2026",
    fiat: "$850.00",
    btc: "0.01160 BTC",
    status: "payment_detected",
  },
  {
    n: "INV-0044",
    client: "Northwind Ltd",
    due: "21 Oct 2026",
    fiat: "$4,200.00",
    btc: "0.05731 BTC",
    status: "pending",
  },
  {
    n: "INV-0039",
    client: "Hollow Pine",
    due: "2 Oct 2026",
    fiat: "$1,150.00",
    btc: "0.01569 BTC",
    status: "underpaid",
  },
  {
    n: "INV-0036",
    client: "Ferris & Co",
    due: "28 Sep 2026",
    fiat: "$640.00",
    btc: "0.00873 BTC",
    status: "overdue",
  },
  {
    n: "INV-0045",
    client: "Juniper Labs",
    due: "No due date",
    fiat: "$300.00",
    btc: "0.00409 BTC",
    status: "draft",
  },
];

export function InvoiceTable({ idPrefix }: { idPrefix: string }) {
  return (
    <div
      id={`${idPrefix}--table`}
      className="overflow-x-auto rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface)"
    >
      <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
        <thead>
          <tr className="border-b border-(--color-border) text-[13px] text-(--color-text-secondary)">
            <th scope="col" className="px-5 py-3 font-medium">
              Invoice
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              Client
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              Due
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              Amount
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {TABLE_ROWS.map((r) => (
            <tr
              key={r.n}
              className={`proxy-id--${idPrefix}--table--row border-b border-(--color-border) last:border-0 hover:bg-(--color-canvas)`}
            >
              <td className="px-5 py-3.5 font-medium tabular-nums">{r.n}</td>
              <td className="px-5 py-3.5">{r.client}</td>
              <td className="px-5 py-3.5 text-(--color-text-secondary)">
                {r.due}
              </td>
              <td className="px-5 py-3.5 text-right">
                <span className="block font-semibold tabular-nums">
                  {r.fiat}
                </span>
                <span className="block text-[13px] text-(--color-text-secondary) tabular-nums">
                  {r.btc}
                </span>
              </td>
              <td className="px-5 py-3.5">
                <StatusBadge status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The payer's view: fiat primary, BTC secondary but clear (DESIGN.md §10). */
export function PaymentPanel({
  idPrefix,
  status = "pending",
  qrSize = 168,
  showNote = true,
  className,
}: {
  idPrefix: string;
  status?: InvoiceStatus;
  qrSize?: number;
  showNote?: boolean;
  className?: string;
}) {
  return (
    <div
      id={`${idPrefix}--payment`}
      className={cn(
        "flex flex-col gap-5 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-6 shadow-(--shadow-overlay)",
        className,
      )}
    >
      <div className="flex flex-wrap-reverse items-start justify-between gap-3">
        <div>
          <p className="text-sm text-(--color-text-secondary)">
            Acme Studio, INV-0042
          </p>
          <p className="font-display tracking-heading mt-1 text-[32px] leading-[1.1] font-[700]">
            $2,500.00
          </p>
          <p className="mt-1 text-[15px] font-medium tabular-nums">
            0.03412000 BTC
          </p>
        </div>
        <StatusBadge
          status={status}
          id={`${idPrefix}--payment--status`}
        />
      </div>
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <div className="shrink-0 rounded-(--radius-md) border border-(--color-border) p-2">
          <BtcQrCode
            uri={`bitcoin:${EXAMPLE_ADDRESS}?amount=0.03412`}
            size={qrSize}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Send bitcoin to</p>
          <p
            id={`${idPrefix}--payment--address`}
            className="mt-1 font-mono text-[13px] leading-[1.5] break-all text-(--color-text-secondary)"
          >
            {EXAMPLE_ADDRESS}
          </p>
          <Button
            id={`${idPrefix}--payment--copy`}
            variant="secondary"
            className="mt-3"
          >
            <Copy />
            Copy address
          </Button>
        </div>
      </div>
      {showNote ? (
        <p className="border-t border-(--color-border) pt-4 text-sm text-(--color-text-secondary)">
          {status === "payment_detected"
            ? "Payment seen on the network. We mark it paid once it confirms."
            : "This page updates on its own when your payment arrives."}
        </p>
      ) : null}
    </div>
  );
}
