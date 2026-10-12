import type { NextConfig } from "next";

// v1.4.24-H (M-FE-5): browser safety headers, applied to every route.
//
// The Content-Security-Policy is deliberately minimal: only frame-ancestors,
// object-src and base-uri. A broader policy (default-src / connect-src /
// script-src) would have to whitelist the two live WebSocket origins the app
// depends on (mempool.space and Supabase Realtime), and a wrong connect-src
// there would silently stop live payment updates while the page still rendered.
// The stricter policy is deferred to its own item so it can be tested properly.
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
  // v1.5.5: the invoice PDF reads its fonts from disk (react-pdf cannot use web
  // fonts), so ship them with both PDF routes.
  outputFileTracingIncludes: {
    "/api/**/pdf": ["./src/lib/invoices/fonts/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
