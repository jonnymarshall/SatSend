import { cn } from "@/lib/utils";

/**
 * Signal Amber status badge (v1.5.0-H). Dot + text, never colour alone
 * (DESIGN.md §8). Keys are the app's real invoice statuses.
 *
 * Decided 2026-10-09 (v1.5.0-H review):
 * - Text uses the AA text shades (--color-*-text); the dot keeps the brighter colour.
 * - `pending` (published, awaiting payment) uses the handoff's "Sent" blue, label
 *   "Pending". `payment_detected` is violet so the two never look alike.
 * - `archived` has no handoff status; it uses Draft neutral, outlined to read as inactive.
 */
export type InvoiceStatus =
  | "draft"
  | "pending"
  | "payment_detected"
  | "paid"
  | "underpaid"
  | "overdue"
  | "archived";

type Tone = { label: string; bg: string; dot: string; text: string; extra?: string };

export const STATUS_TONES: Record<InvoiceStatus, Tone> = {
  draft: {
    label: "Draft",
    bg: "bg-(--color-neutral-soft)",
    dot: "bg-(--color-neutral)",
    text: "text-(--color-neutral-text)",
  },
  pending: {
    label: "Pending",
    bg: "bg-(--color-sent-soft)",
    dot: "bg-(--color-sent)",
    text: "text-(--color-sent-text)",
  },
  payment_detected: {
    label: "Payment detected",
    bg: "bg-(--color-detected-soft)",
    dot: "bg-(--color-detected)",
    text: "text-(--color-detected-text)",
  },
  paid: {
    label: "Paid",
    bg: "bg-(--color-success-soft)",
    dot: "bg-(--color-success)",
    text: "text-(--color-success-text)",
  },
  underpaid: {
    label: "Underpaid",
    bg: "bg-(--color-warning-soft)",
    dot: "bg-(--color-warning)",
    text: "text-(--color-warning-text)",
  },
  overdue: {
    label: "Overdue",
    bg: "bg-(--color-danger-soft)",
    dot: "bg-(--color-danger)",
    text: "text-(--color-danger-text)",
  },
  archived: {
    label: "Archived",
    bg: "bg-transparent",
    dot: "bg-(--color-neutral)",
    text: "text-(--color-neutral-text)",
    extra: "border border-(--color-border)",
  },
};

export function StatusBadge({
  status,
  id,
  className,
}: {
  status: InvoiceStatus;
  id?: string;
  className?: string;
}) {
  const t = STATUS_TONES[status];
  return (
    <span
      id={id}
      className={cn(
        "inline-flex min-h-7 items-center gap-[0.45rem] rounded-(--radius-pill) px-[0.65rem] py-1 text-[13px] leading-none font-medium whitespace-nowrap",
        t.bg,
        t.extra,
        t.text,
        className,
      )}
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", t.dot)} />
      {t.label}
    </span>
  );
}
