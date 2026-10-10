/**
 * WCAG 2.x contrast helpers (v1.5.0-H). Used by the internal styleguide's contrast
 * audit so every ratio shown there is computed, not hand-typed.
 */

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type ContrastUse = "text" | "large-text" | "ui";

/** WCAG AA thresholds: 4.5 body text, 3 for large text (>=24px, or >=18.66px bold) and UI. */
export function aaThreshold(use: ContrastUse): number {
  return use === "text" ? 4.5 : 3;
}

export function passesAA(fg: string, bg: string, use: ContrastUse): boolean {
  return contrastRatio(fg, bg) >= aaThreshold(use);
}
