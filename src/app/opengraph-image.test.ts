import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";
import { OG_FONT_FILES, size } from "./opengraph-image";

// v1.5.17: the link-preview image draws with the brand fonts, read from disk.
describe("link-preview image (v1.5.17)", () => {
  it("is the standard 1200 × 630", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
  });

  it("uses Onest for the wordmark and headline", () => {
    expect(OG_FONT_FILES.some((f) => f.includes("Onest"))).toBe(true);
  });

  it.each(OG_FONT_FILES)("%s exists", (file) => {
    expect(existsSync(path.join(process.cwd(), file))).toBe(true);
  });

  it("ships its fonts to production with the route", () => {
    const includes = nextConfig.outputFileTracingIncludes ?? {};
    const forRoute = includes["/opengraph-image"] ?? [];
    expect(forRoute).toContain("./src/lib/invoices/fonts/**/*");
  });
});
