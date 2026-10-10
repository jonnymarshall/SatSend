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
