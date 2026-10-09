import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { PROPOSED_BORDER_STRONG, PROPOSED_TEXT_SHADES } from "./proposed-tokens";

// Drift guard (v1.5.0-H): every token in the brand handoff must appear with the
// same value in our scoped token sheet, so the kit always shows the real spec.
const root = process.cwd();
const handoff = readFileSync(join(root, "satsend-brand-handoff/design-tokens.css"), "utf8");
const ours = readFileSync(join(root, "src/styles/signal-amber.css"), "utf8");

function tokens(css: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  for (const m of css.matchAll(re)) out.set(m[1], m[2].replace(/\s+/g, " ").trim());
  return out;
}

const spec = tokens(handoff);
const mine = tokens(ours);

describe("Signal Amber tokens", () => {
  it("reads the handoff tokens", () => {
    expect(spec.size).toBeGreaterThanOrEqual(40);
  });

  it.each([...spec.keys()].filter((k) => !k.startsWith("--font-")))(
    "%s matches the handoff",
    (key) => {
      expect(mine.get(key)?.toUpperCase()).toBe(spec.get(key)?.toUpperCase());
    },
  );

  it("font tokens keep the handoff family names as fallbacks", () => {
    expect(mine.get("--font-display")).toContain('"Onest"');
    expect(mine.get("--font-body")).toContain('"Geist"');
  });

  it("the PROPOSED tokens in TS and CSS agree", () => {
    for (const p of [...Object.values(PROPOSED_TEXT_SHADES), PROPOSED_BORDER_STRONG]) {
      expect(mine.get(p.token)?.toUpperCase(), p.token).toBe(p.value.toUpperCase());
    }
  });

  it("every PROPOSED text shade reaches AA 4.5:1 on its surface", () => {
    const pairs: Array<[string, string]> = [
      ["--color-success-text", "--color-success-soft"],
      ["--color-sent-text", "--color-sent-soft"],
      ["--color-detected-text", "--color-detected-soft"],
      ["--color-warning-text", "--color-warning-soft"],
      ["--color-danger-text", "--color-danger-soft"],
      ["--color-neutral-text", "--color-neutral-soft"],
      ["--color-brand-text", "--color-canvas"],
    ];
    for (const [fg, bg] of pairs) {
      expect(contrastRatio(mine.get(fg)!, mine.get(bg)!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(mine.get("--color-border-strong")!, "#FFFFFF")).toBeGreaterThanOrEqual(3);
  });
});
