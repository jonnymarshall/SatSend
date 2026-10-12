import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { brandColors, statusColors, type BrandColor } from "./brand-colors";

// Drift guard between the Signal Amber tokens in src/styles/signal-amber.css (the
// source of truth since v1.5-H) and the hex mirror in brand-colors.ts that the PDF
// uses. If either side changes without the other, this fails.

const CSS = readFileSync(path.resolve(__dirname, "../styles/signal-amber.css"), "utf8");
const TOKENS = new Map(
  [...CSS.matchAll(/(--color-[a-z-]+)\s*:\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2].toUpperCase()]),
);

const PAIRS: [BrandColor, string][] = [
  ["ink", "--color-ink"],
  ["canvas", "--color-canvas"],
  ["surface", "--color-surface"],
  ["brand", "--color-brand"],
  ["brandText", "--color-brand-text"],
  ["textSecondary", "--color-text-secondary"],
  ["border", "--color-border"],
  ["foreground", "--color-ink"],
  ["paper", "--color-surface"],
  ["primary", "--color-brand-text"],
  ["muted", "--color-text-secondary"],
];

describe("brand colours stay in lockstep with signal-amber.css", () => {
  it.each(PAIRS)("%s matches %s", (field, token) => {
    expect(TOKENS.get(token), token).toBeTruthy();
    expect(brandColors[field].toUpperCase()).toBe(TOKENS.get(token));
  });

  it("the old red accent is gone", () => {
    expect(Object.values(brandColors).map((c) => c.toUpperCase())).not.toContain("#D02A3A");
  });
});

describe("status colours (emails + PDF) stay in lockstep with signal-amber.css (v1.5.5)", () => {
  const TOKEN: Record<string, string> = {
    draft: "neutral",
    pending: "sent",
    payment_detected: "detected",
    paid: "success",
    underpaid: "warning",
    overdue: "danger",
    archived: "neutral",
  };
  it.each(Object.entries(statusColors))("%s matches its tokens", (key, c) => {
    const t = TOKEN[key];
    if (key !== "archived") expect(c.fill.toUpperCase()).toBe(TOKENS.get(`--color-${t}-soft`));
    expect(c.dot.toUpperCase()).toBe(TOKENS.get(`--color-${t}`));
    expect(c.text.toUpperCase()).toBe(TOKENS.get(`--color-${t}-text`));
  });
});
