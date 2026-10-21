import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// v1.5.23: SatSend is source available under FSL-1.1-ALv2 (Jonny, 2026-10-21).
const root = process.cwd();

describe("licence (v1.5.23)", () => {
  const licence = readFileSync(path.join(root, "LICENSE.md"), "utf8");

  it("is the FSL-1.1-ALv2 text with the notice filled in", () => {
    expect(licence).toMatch(/^# Functional Source License, Version 1\.1, ALv2 Future License/);
    expect(licence).toContain("Copyright 2026 SATSEND LLC");
    expect(licence).not.toContain("${");
  });

  it("package.json declares it with its standard short code", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    expect(pkg.license).toBe("FSL-1.1-ALv2");
  });

  it("the README explains it without calling SatSend open source", () => {
    const readme = readFileSync(path.join(root, "README.md"), "utf8");
    expect(readme).toMatch(/source available/i);
    expect(readme).toContain("FSL-1.1-ALv2");
    expect(readme).toContain("https://fsl.software");
    expect(readme).not.toMatch(/SatSend is (fully )?open[- ]source/i);
  });
});
