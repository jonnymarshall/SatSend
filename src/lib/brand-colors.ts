// Brand palette as hex, for contexts that cannot use CSS variables (e.g.
// @react-pdf/renderer). Mirrors the Signal Amber tokens in
// src/styles/signal-amber.css, which is the single source of truth (v1.5-H; it
// used to mirror the retired `.dark` block in globals.css). Guarded against drift
// by brand-colors.test.ts.
//
// The PDF keys (`foreground`, `paper`, `primary`, `muted`) are kept so the PDF
// picks up the new palette without a layout change; the PDF restyle is v1.5.1-H.
// `primary` is the AA brand text shade, not the bright amber: the PDF draws it as
// text on white, where #D89B24 is only 2.4:1.
export const brandColors = {
  ink: "#151C2E", //           --color-ink
  canvas: "#FCFBF7", //        --color-canvas
  surface: "#FFFFFF", //       --color-surface
  brand: "#D89B24", //         --color-brand
  brandText: "#926D28", //     --color-brand-text
  textSecondary: "#6F7282", // --color-text-secondary
  border: "#ECE8DD", //        --color-border
  foreground: "#151C2E", //    PDF text            = --color-ink
  paper: "#FFFFFF", //         PDF page            = --color-surface
  primary: "#926D28", //       PDF accent / totals = --color-brand-text
  muted: "#6F7282", //         PDF metadata        = --color-text-secondary
} as const;

export type BrandColor = keyof typeof brandColors;

/**
 * Semantic status colours for emails and the PDF (v1.5.5), mirroring
 * signal-amber.css: `fill` = --color-*-soft, `dot` = --color-*, `text` = the AA
 * --color-*-text shade. Same mapping as the in-app StatusBadge.
 */
export const statusColors = {
  draft: { label: "Draft", fill: "#F0F1F3", dot: "#7A8190", text: "#676E7D" },
  pending: { label: "Pending", fill: "#EAF0FF", dot: "#4776E6", text: "#3F68C9" },
  payment_detected: { label: "Payment detected", fill: "#F3EFFE", dot: "#8B5CF6", text: "#7B53DB" },
  paid: { label: "Paid", fill: "#E7F6F0", dot: "#2F9A74", text: "#297C63" },
  underpaid: { label: "Underpaid", fill: "#FFF2DD", dot: "#F0A43B", text: "#906835" },
  overdue: { label: "Overdue", fill: "#FCE8E8", dot: "#D95F5F", text: "#AA4F53" },
  archived: { label: "Archived", fill: "#FFFFFF", dot: "#7A8190", text: "#676E7D" },
} as const;

export type StatusColorKey = keyof typeof statusColors;
