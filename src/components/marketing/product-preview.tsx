import { FileText } from "lucide-react";
import { BtcQrCode } from "@/components/btc-qr-code";
import { StatusBadge, type InvoiceStatus } from "@/components/signal/status-badge";
import { cn } from "@/lib/utils";

/*
 * Pictures of the product for the marketing site (v1.5.16; moved from the
 * internal style guide). SAMPLE DATA and display only: nothing here is a real
 * control, and the QR code deliberately encodes plain text, not a `bitcoin:`
 * payment request, so a visitor scanning it can't send money anywhere.
 */

export const PREVIEW_QR_VALUE = "SatSend example invoice. This is a picture, not a payment request.";

const SAMPLE_ADDRESS = "bc1q…example…7kv8f3t4";

/** The page your client sees: fiat first, bitcoin amount clear, QR code. */
export function PaymentPreview({
  idPrefix,
  status = "pending",
  className,
}: {
  idPrefix: string;
  status?: InvoiceStatus;
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
          <p className="text-sm text-(--color-text-secondary)">Acme Studio, INV-0042</p>
          <p className="font-display tracking-heading mt-1 text-[32px] leading-[1.1] font-[700]">$2,500.00</p>
          <p className="mt-1 text-[15px] font-medium tabular-nums">0.03412000 BTC</p>
        </div>
        <StatusBadge status={status} id={`${idPrefix}--payment--status`} />
      </div>
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <div className="shrink-0 rounded-(--radius-md) border border-(--color-border) p-2">
          <BtcQrCode uri={PREVIEW_QR_VALUE} size={136} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Send bitcoin to</p>
          <p className="mt-1 font-mono text-[13px] leading-[1.5] break-all text-(--color-text-secondary)">
            {SAMPLE_ADDRESS}
          </p>
          <p className="mt-3 text-sm text-(--color-text-secondary)">
            {status === "payment_detected"
              ? "Payment seen on the network. Marked paid once it confirms."
              : "This page updates on its own when the payment arrives."}
          </p>
        </div>
      </div>
    </div>
  );
}

/** One invoice as it appears in your list. */
export function InvoiceRowPreview({
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
      id={`${idPrefix}--invoice-row`}
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
        <p className="truncate text-[15px] font-semibold">{title}</p>
        <p className="truncate text-sm text-(--color-text-secondary)">
          {client}, {date}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 text-right">
        <p className="text-[15px] font-semibold tabular-nums">{fiat}</p>
        <p className="text-[13px] text-(--color-text-secondary) tabular-nums">{btc}</p>
        <StatusBadge status={status} id={`${idPrefix}--invoice-row--status`} className="mt-1" />
      </div>
    </div>
  );
}
