import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";
import { OG_FONT_FILES, OG_LOGO_FILE, size } from "./opengraph-image";

// v1.5.17: the link-preview image draws with the brand fonts, read from disk.
describe("link-preview image (v1.5.17)", () => {
  it("is the standard 1200 × 630", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
  });

  it("uses Onest for the headline", () => {
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

// v1.5.24 (roadmap v1.5.2.0.2-H): typing "SatSend" + ".me" as two text spans let
// the image generator drop ".me" below the baseline (seen on WhatsApp). The
// logo is now the site's own logo file, drawn as shapes.
describe("link-preview logo (v1.5.24)", () => {
  it("is the site's logo file", () => {
    expect(OG_LOGO_FILE).toBe("public/brand/satsend-logo.svg");
    expect(existsSync(path.join(process.cwd(), OG_LOGO_FILE))).toBe(true);
  });

  it("is drawn as shapes, not typed text (so nothing can mis-align)", () => {
    const svg = readFileSync(path.join(process.cwd(), OG_LOGO_FILE), "utf8");
    expect(svg).toContain("<path");
    expect(svg).not.toMatch(/<text|<tspan/);
  });

  it("ships the logo file to production with the route", () => {
    const forRoute = nextConfig.outputFileTracingIncludes?.["/opengraph-image"] ?? [];
    expect(forRoute).toContain(`./${OG_LOGO_FILE}`);
  });
});
