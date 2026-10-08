// Brand palette mirroring the canonical colour tokens in src/app/globals.css
// (the `.dark` block). **globals.css is the single source of truth** — it is what
// the app actually renders — and this file carries browser-accurate hex
// equivalents for contexts that cannot use CSS variables (e.g. @react-pdf/renderer).
//
// `foreground` and `paper` are PDF-specific (dark text on white paper) and have no
// `.dark` token. The other four are guarded against drift by brand-colors.test.ts.
export const brandColors = {
  background: "#010101", // .dark --background:       oklch(0.06 0 0)
  surface: "#070707", //    .dark --card:             oklch(0.13 0 0)
  primary: "#D02A3A", //    .dark --primary:          oklch(0.56 0.2 22)
  muted: "#727460", //      .dark --muted-foreground: oklch(0.55 0.03 112)
  foreground: "#0A0A0A", // PDF text on white paper (no .dark token)
  paper: "#FFFFFF", //      PDF page (no .dark token)
} as const;

export type BrandColor = keyof typeof brandColors;
