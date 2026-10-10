import handoff from "../../../satsend-brand-handoff/design-tokens.json";

/**
 * ADOPTED tokens (v1.5.0-H, decided 2026-10-09 in the UI-kit review). These are
 * the colours SatSend actually uses where they differ from, or add to, the brand
 * handoff. The handoff folder stays untouched as the designer's record; this file
 * plus src/styles/signal-amber.css are the source of truth. The drift test
 * (signal-amber-tokens.test.ts) asserts both agree and that each reaches AA.
 */
export const DECIDED_ON = "2026-10-09";

/**
 * Handoff tokens we deliberately changed. Everything else must match the handoff.
 * Payment detected: the handoff value (#6E7CF6) read as almost the same blue as
 * Pending (#4776E6, contrast 1.17:1 between them). The brief says "Payment detected
 * uses violet", so it moves to a true violet.
 */
export const OVERRIDES = {
  "--color-detected": { key: "detected", spec: "#6E7CF6", value: "#8B5CF6" },
  "--color-detected-soft": { key: "detectedSoft", spec: "#ECEEFF", value: "#F3EFFE" },
} as const;

/**
 * Text shades: every handoff status colour is too faint to read as 13px text on its
 * own soft background, so text uses the same hue darkened toward ink until it
 * reaches 4.5:1. Dots and fills keep the brighter colour.
 */
export const TEXT_SHADES = {
  success: { token: "--color-success-text", value: "#297C63", on: "successSoft" },
  sent: { token: "--color-sent-text", value: "#3F68C9", on: "sentSoft" },
  detected: { token: "--color-detected-text", value: "#7B53DB", on: "detectedSoft" },
  warning: { token: "--color-warning-text", value: "#906835", on: "warningSoft" },
  danger: { token: "--color-danger-text", value: "#AA4F53", on: "dangerSoft" },
  neutral: { token: "--color-neutral-text", value: "#676E7D", on: "neutralSoft" },
  brand: { token: "--color-brand-text", value: "#926D28", on: "canvas" },
} as const;

/** Input outline: the handoff border (#ECE8DD) is nearly invisible on white (1.22:1). */
export const BORDER_STRONG = { token: "--color-border-strong", value: "#949495", on: "surface" } as const;

/**
 * Amber that has to be SEEN, not just decorate: the hero's large amber line and the
 * input focus border. Spec amber is 2.35:1 on canvas; this is the lightest amber
 * that reaches the 3:1 minimum for large text and UI outlines.
 */
export const BRAND_STRONG = { token: "--color-brand-strong", value: "#BC8925", on: "canvas" } as const;

/** The palette in use: the handoff colours with the overrides applied. */
export const PALETTE = {
  ...handoff.color,
  ...Object.fromEntries(Object.values(OVERRIDES).map((o) => [o.key, o.value])),
} as typeof handoff.color;
