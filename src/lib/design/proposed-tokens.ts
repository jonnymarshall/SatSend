/**
 * PROPOSED tokens (v1.5.0-H) — not in the brand handoff. Mirrored in
 * src/styles/signal-amber.css; the drift test asserts both agree and that each
 * reaches its AA threshold. Each text shade is the spec hue mixed toward ink
 * (#151C2E) just far enough to reach 4.5:1 on its intended background.
 */
export const PROPOSED_TEXT_SHADES = {
  success: { token: "--color-success-text", value: "#297C63", on: "successSoft" },
  sent: { token: "--color-sent-text", value: "#3F68C9", on: "sentSoft" },
  detected: { token: "--color-detected-text", value: "#5864C4", on: "detectedSoft" },
  warning: { token: "--color-warning-text", value: "#906835", on: "warningSoft" },
  danger: { token: "--color-danger-text", value: "#AA4F53", on: "dangerSoft" },
  neutral: { token: "--color-neutral-text", value: "#676E7D", on: "neutralSoft" },
  brand: { token: "--color-brand-text", value: "#926D28", on: "canvas" },
} as const;

export const PROPOSED_BORDER_STRONG = { token: "--color-border-strong", value: "#949495", on: "surface" } as const;
