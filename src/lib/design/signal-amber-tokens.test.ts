import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BORDER_STRONG, BRAND_STRONG, OVERRIDES, PALETTE, TEXT_SHADES } from "./adopted-tokens";
import { contrastRatio, hexToRgb } from "./contrast";

// Drift guard (v1.5.0-H): every token in the brand handoff must appear with the
// same value in our scoped token sheet, except the deliberate OVERRIDES, so the kit
// always shows the real spec plus only the decisions we recorded.
const root = process.cwd();
const handoff = readFileSync(join(root, "satsend-brand-handoff/design-tokens.css"), "utf8");
const ours = readFileSync(join(root, "src/styles/signal-amber.css"), "utf8");

function tokens(css: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  for (const m of css.matchAll(re)) out.set(m[1], m[2].replace(/\s+/g, " ").trim());
  return out;
}

/** Hue in degrees (HSL), enough to tell blue from violet. */
function hue(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const spec = tokens(handoff);
const mine = tokens(ours);
const overridden = new Set(Object.keys(OVERRIDES));

describe("Signal Amber tokens", () => {
  it("reads the handoff tokens", () => {
    expect(spec.size).toBeGreaterThanOrEqual(40);
  });

  it.each([...spec.keys()].filter((k) => !k.startsWith("--font-") && !overridden.has(k)))(
    "%s matches the handoff",
    (key) => {
      expect(mine.get(key)?.toUpperCase()).toBe(spec.get(key)?.toUpperCase());
    },
  );

  it("each override records the real handoff value and is applied in CSS and the palette", () => {
    for (const [token, o] of Object.entries(OVERRIDES)) {
      expect(spec.get(token)?.toUpperCase(), token).toBe(o.spec.toUpperCase());
      expect(mine.get(token)?.toUpperCase(), token).toBe(o.value.toUpperCase());
      expect(PALETTE[o.key]).toBe(o.value);
    }
  });

  it("font tokens keep the handoff family names as fallbacks", () => {
    expect(mine.get("--font-display")).toContain('"Onest"');
    expect(mine.get("--font-body")).toContain('"Geist"');
  });

  it("the ADOPTED tokens in TS and CSS agree", () => {
    for (const p of [...Object.values(TEXT_SHADES), BORDER_STRONG, BRAND_STRONG]) {
      expect(mine.get(p.token)?.toUpperCase(), p.token).toBe(p.value.toUpperCase());
    }
  });

  it("every text shade reaches AA 4.5:1 on its surface", () => {
    for (const s of Object.values(TEXT_SHADES)) {
      const bg = PALETTE[s.on];
      expect(contrastRatio(s.value, bg), `${s.token} on ${s.on}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("outline and strong amber reach the 3:1 minimum for UI and large text", () => {
    expect(contrastRatio(BORDER_STRONG.value, PALETTE.surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(BRAND_STRONG.value, PALETTE.canvas)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(BRAND_STRONG.value, PALETTE.surface)).toBeGreaterThanOrEqual(3);
  });

  it("Pending (sent blue) and Payment detected are clearly different hues", () => {
    expect(Math.abs(hue(PALETTE.detected) - hue(PALETTE.sent))).toBeGreaterThanOrEqual(30);
  });
});
