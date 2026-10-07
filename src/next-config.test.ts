import { describe, it, expect } from "vitest";
import nextConfig from "../next.config";

describe("next.config security headers (v1.4.24-H / M-FE-5)", () => {
  it("applies the clickjacking, sniffing, referrer and transport headers to every route", async () => {
    const groups = await nextConfig.headers!();
    expect(groups).toHaveLength(1);
    expect(groups[0].source).toBe("/:path*");
    const map = Object.fromEntries(groups[0].headers.map((h) => [h.key, h.value]));
    expect(map["X-Frame-Options"]).toBe("DENY");
    expect(map["X-Content-Type-Options"]).toBe("nosniff");
    expect(map["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(map["Strict-Transport-Security"]).toContain("max-age=");
  });

  it("keeps the CSP to frame-ancestors/object-src/base-uri only, so the live sockets are untouched", async () => {
    const groups = await nextConfig.headers!();
    const csp = groups[0].headers.find((h) => h.key === "Content-Security-Policy")!.value;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).not.toContain("connect-src");
    expect(csp).not.toContain("default-src");
    expect(csp).not.toContain("script-src");
  });
});
