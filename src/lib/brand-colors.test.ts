import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { brandColors } from "./brand-colors";

// v1.4.30.1-H — drift guard between the canonical colour tokens in globals.css
// (the `.dark` block) and the hex mirror in brand-colors.ts that the PDF uses.
// globals.css is the source of truth; if either side changes without the other,
// this fails.

// OKLCH -> sRGB hex, matching how browsers render the CSS tokens (CSS Color 4).
function oklchToHex(l: number, c: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const lc = l_ ** 3;
  const mc = m_ ** 3;
  const sc = s_ ** 3;
  const r = 4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
  const g = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
  const bl = -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc;
  const enc = (x: number) => {
    const v = Math.max(0, Math.min(1, x));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  };
  const to = (x: number) => Math.round(enc(x) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(bl)}`.toUpperCase();
}

function darkTokens(css: string): Record<string, string> {
  const start = css.indexOf(".dark {");
  const block = css.slice(start, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*oklch\(([^)]+)\)/g)) out[m[1]] = m[2];
  return out;
}

const CSS = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");
const DARK = darkTokens(CSS);
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// brandColors field -> `.dark` token it must equal.
const PAIRS: [keyof typeof brandColors, string][] = [
  ["background", "background"],
  ["surface", "card"],
  ["primary", "primary"],
  ["muted", "muted-foreground"],
];

describe("v1.4.30.1-H — brand colours stay in lockstep with globals.css", () => {
  it("finds the .dark tokens", () => {
    for (const [, token] of PAIRS) expect(DARK[token], `--${token}`).toBeTruthy();
  });

  for (const [field, token] of PAIRS) {
    it(`${field} matches .dark --${token} (±2/channel)`, () => {
      const [l, c, h] = DARK[token].split(/\s+/).map(Number);
      const expected = rgb(oklchToHex(l, c, h || 0));
      const actual = rgb(brandColors[field]);
      for (let i = 0; i < 3; i++) {
        expect(
          Math.abs(actual[i] - expected[i]),
          `${field} channel ${i}: ${brandColors[field]} vs ${oklchToHex(l, c, h || 0)}`,
        ).toBeLessThanOrEqual(2);
      }
    });
  }
});
