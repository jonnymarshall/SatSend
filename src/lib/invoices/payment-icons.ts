import type { PaymentState } from "./payment-summary";

/**
 * The payment-state icons' shapes (Lucide, 24×24, stroke 2), for places that
 * can't use lucide-react: the PDF draws them itself (v1.5.28). Copied from the
 * same icons the client's invoice page shows; a test fails if they drift.
 */
export type IconNode = ReadonlyArray<
  readonly ["circle", { cx: string; cy: string; r: string }] | readonly ["path", { d: string }]
>;

export const PAYMENT_ICON_NODES: Record<PaymentState, IconNode> = {
  // Clock
  payment_detected: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 6v6l4 2" }],
  ],
  // CircleCheck
  paid: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "m9 12 2 2 4-4" }],
  ],
  // TriangleAlert
  underpaid: [
    ["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }],
    ["path", { d: "M12 9v4" }],
    ["path", { d: "M12 17h.01" }],
  ],
  // CirclePlus
  overpaid: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M8 12h8" }],
    ["path", { d: "M12 8v8" }],
  ],
};
