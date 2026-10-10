import { STATUS_TONES, StatusBadge, type InvoiceStatus } from "@/components/signal/status-badge";

/**
 * App-facing status badge. Accepts the raw status string from the database and
 * renders the Signal Amber StatusBadge (dot + label, semantic colours, v1.5-H).
 * Unknown values fall back to Draft rather than crashing.
 */
export function InvoiceStatusBadge({ status, id }: { status: string; id?: string }) {
  const known = (status in STATUS_TONES ? status : "draft") as InvoiceStatus;
  return <StatusBadge status={known} id={id} />;
}
