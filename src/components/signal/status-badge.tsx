import { cn } from "@/lib/utils";

/**
 * Signal Amber status badge (v1.5.0-H). Dot + text, never colour alone
 * (DESIGN.md §8). Keys are the app's real invoice statuses.
 *
 * Mapping decisions (flagged in the v1.5.0-H PR):
 * - `pending` (published, awaiting payment) uses the handoff's "Sent" blue.
 * - `archived` has no handoff status; it uses Draft neutral, outlined to read as inactive.
 *
 * `text="spec"` uses the handoff foreground colours (all below 4.5:1 on their soft
 * backgrounds at 13px). `text="aa"` uses the PROPOSED AA text shades; the dot keeps
 * the spec colour either way.
 */
export type InvoiceStatus =
  | "draft"
  | "pending"
  | "payment_detected"
  | "paid"
  | "underpaid"
  | "overdue"
  | "archived";

type Tone = { label: string; bg: string; dot: string; spec: string; aa: string; extra?: string };

export const STATUS_TONES: Record<InvoiceStatus, Tone> = {
  draft: {
    label: "Draft",
    bg: "bg-(--color-neutral-soft)",
    dot: "bg-(--color-neutral)",
    spec: "text-(--color-neutral)",
    aa: "text-(--color-neutral-text)",
  },
  pending: {
    label: "Pending",
    bg: "bg-(--color-sent-soft)",
    dot: "bg-(--color-sent)",
    spec: "text-(--color-sent)",
    aa: "text-(--color-sent-text)",
  },
  payment_detected: {
    label: "Payment detected",
    bg: "bg-(--color-detected-soft)",
    dot: "bg-(--color-detected)",
    spec: "text-(--color-detected)",
    aa: "text-(--color-detected-text)",
  },
  paid: {
    label: "Paid",
    bg: "bg-(--color-success-soft)",
    dot: "bg-(--color-success)",
    spec: "text-(--color-success)",
    aa: "text-(--color-success-text)",
  },
  underpaid: {
    label: "Underpaid",
    bg: "bg-(--color-warning-soft)",
    dot: "bg-(--color-warning)",
    spec: "text-(--color-warning)",
    aa: "text-(--color-warning-text)",
  },
  overdue: {
    label: "Overdue",
    bg: "bg-(--color-danger-soft)",
    dot: "bg-(--color-danger)",
    spec: "text-(--color-danger)",
    aa: "text-(--color-danger-text)",
  },
  archived: {
    label: "Archived",
    bg: "bg-transparent",
    dot: "bg-(--color-neutral)",
    spec: "text-(--color-neutral)",
    aa: "text-(--color-neutral-text)",
    extra: "border border-(--color-border)",
  },
};

export function StatusBadge({
  status,
  text = "spec",
  id,
  className,
}: {
  status: InvoiceStatus;
  text?: "spec" | "aa";
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
        text === "aa" ? t.aa : t.spec,
        className,
      )}
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", t.dot)} />
      {t.label}
    </span>
  );
}
