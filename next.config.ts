import type { NextConfig } from "next";

// v1.4.24-H (M-FE-5): browser safety headers, applied to every route.
//
// The Content-Security-Policy here is a minimal baseline (frame-ancestors,
// object-src, base-uri) for files the proxy doesn't run on, such as images.
// Pages get the strict, per-request nonce policy from src/proxy.ts
// (src/lib/csp.ts, v1.5.33), which replaces this header on every response the
// proxy handles.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'none'",
  },
];

const nextConfig: NextConfig = {
  // v1.5.18: the How it works screenshots are served at 90 so their text stays
  // sharp; Next 16 only allows qualities listed here.
  images: { qualities: [75, 90] },
  // v1.5.5: the invoice PDF reads its fonts from disk (react-pdf cannot use web
  // fonts), so ship them with both PDF routes. v1.5.17: the link-preview image
  // reads the same files.
  outputFileTracingIncludes: {
    "/api/**/pdf": ["./src/lib/invoices/fonts/**/*"],
    "/opengraph-image": ["./src/lib/invoices/fonts/**/*", "./public/brand/satsend-logo.svg"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
