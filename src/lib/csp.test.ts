import { describe, it, expect } from "vitest";
import { buildCsp, createNonce } from "./csp";

// v1.5.33 (roadmap v1.5.2.24-H): the strict Content-Security-Policy. Scripts
// run only with this request's nonce; the browser may connect only to SatSend,
// its Supabase project and mempool.space (the two live sockets payment updates
// depend on).
const SUPABASE = "https://abcdefghijklmnop.supabase.co";

function directives(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values];
      }),
  );
}

describe("buildCsp", () => {
  const prod = directives(buildCsp({ nonce: "abc123", supabaseUrl: SUPABASE, isDev: false }));

  it("lets scripts run only with this request's nonce (and what they load), never inline or eval", () => {
    expect(prod["script-src"]).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(prod["script-src"]).not.toContain("'unsafe-inline'");
    expect(prod["script-src"]).not.toContain("'unsafe-eval'");
  });

  it("connects only to SatSend, its Supabase project and mempool.space, over https and wss", () => {
    expect(prod["connect-src"]).toEqual([
      "'self'",
      "https://abcdefghijklmnop.supabase.co",
      "wss://abcdefghijklmnop.supabase.co",
      "https://mempool.space",
      "wss://mempool.space",
    ]);
  });

  it("uses the Supabase URL's origin only, whatever path or slash it was given with", () => {
    const d = directives(buildCsp({ nonce: "n", supabaseUrl: `${SUPABASE}/`, isDev: false }));
    expect(d["connect-src"]).toContain("wss://abcdefghijklmnop.supabase.co");
    expect(d["connect-src"].join(" ")).not.toContain(".co/");
  });

  it("falls back to everything else being SatSend's own, and closes the usual gaps", () => {
    expect(prod["default-src"]).toEqual(["'self'"]);
    expect(prod["img-src"]).toEqual(["'self'", "data:", "blob:"]);
    expect(prod["font-src"]).toEqual(["'self'"]);
    expect(prod["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(prod["object-src"]).toEqual(["'none'"]);
    expect(prod["base-uri"]).toEqual(["'none'"]);
    expect(prod["form-action"]).toEqual(["'self'"]);
    expect(prod["frame-ancestors"]).toEqual(["'none'"]);
    expect(prod["frame-src"]).toEqual(["'none'"]);
    expect(prod["upgrade-insecure-requests"]).toEqual([]);
  });

  it("in development adds 'unsafe-eval' (React's error overlay needs it) and doesn't force https", () => {
    const dev = directives(buildCsp({ nonce: "n", supabaseUrl: SUPABASE, isDev: true }));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev).not.toHaveProperty("upgrade-insecure-requests");
  });

  it("is one line, as an HTTP header must be", () => {
    expect(buildCsp({ nonce: "n", supabaseUrl: SUPABASE, isDev: false })).not.toMatch(/\n/);
  });
});

describe("createNonce", () => {
  it("is base64 and different every time", () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(a.length).toBeGreaterThanOrEqual(22);
    expect(a).not.toBe(b);
  });
});
