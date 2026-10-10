import { describe, expect, it } from "vitest";
import { aaThreshold, contrastRatio, hexToRgb, passesAA } from "./contrast";

describe("contrast", () => {
  it("parses hex", () => {
    expect(hexToRgb("#D89B24")).toEqual([216, 155, 36]);
    expect(() => hexToRgb("#fff")).toThrow();
  });

  it("black on white is 21:1 and is symmetric", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
  });

  it("matches the handoff's own amber audit (ink passes, white fails)", () => {
    expect(contrastRatio("#151C2E", "#D89B24")).toBeCloseTo(6.98, 1);
    expect(passesAA("#151C2E", "#D89B24", "text")).toBe(true);
    expect(passesAA("#FFFFFF", "#D89B24", "text")).toBe(false);
  });

  it("uses WCAG AA thresholds", () => {
    expect(aaThreshold("text")).toBe(4.5);
    expect(aaThreshold("large-text")).toBe(3);
    expect(aaThreshold("ui")).toBe(3);
  });
});
