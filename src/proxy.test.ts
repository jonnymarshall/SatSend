import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@supabase/ssr";
import { proxy, config } from "./proxy";

function makeRequest(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

function mockUser(user: object | null) {
  vi.mocked(createServerClient).mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as unknown as ReturnType<typeof createServerClient>);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdefghijklmnop.supabase.co";
});

describe("proxy", () => {
  describe("protected routes", () => {
    it("redirects unauthenticated user from /dashboard to /login", async () => {
      mockUser(null);
      const res = await proxy(makeRequest("/dashboard"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });

    it("allows authenticated user through to /dashboard", async () => {
      mockUser({ id: "u1" });
      const res = await proxy(makeRequest("/dashboard"));
      expect(res.status).not.toBe(307);
    });
  });

  describe("public routes", () => {
    it("allows unauthenticated access to /login", async () => {
      mockUser(null);
      const res = await proxy(makeRequest("/login"));
      expect(res.status).not.toBe(307);
    });

    it("allows unauthenticated access to /invoice/:id", async () => {
      mockUser(null);
      const res = await proxy(makeRequest("/invoice/abc123"));
      expect(res.status).not.toBe(307);
    });
  });

  describe("auth check uses getUser, not getSession (v1.4.24-H / M-FE-4)", () => {
    it("revalidates the token via getUser", async () => {
      const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
      vi.mocked(createServerClient).mockReturnValue({
        auth: { getUser },
      } as unknown as ReturnType<typeof createServerClient>);
      await proxy(makeRequest("/dashboard"));
      expect(getUser).toHaveBeenCalledTimes(1);
    });
  });

  // v1.5.33 (roadmap v1.5.2.24-H): every page gets the strict CSP with a fresh
  // nonce, and Next sees the same policy on the request so it can put the
  // nonce on its own scripts.
  describe("strict Content-Security-Policy", () => {
    function nonceOf(csp: string | null) {
      return csp?.match(/'nonce-([^']+)'/)?.[1];
    }

    it("sends a CSP with a nonce on a page response", async () => {
      mockUser(null);
      const res = await proxy(makeRequest("/invoice/abc123"));
      const csp = res.headers.get("content-security-policy");
      expect(csp).toContain("script-src 'self' 'nonce-");
      expect(csp).toContain("'strict-dynamic'");
      expect(csp).toContain("wss://mempool.space");
      expect(nonceOf(csp)).toBeTruthy();
    });

    it("passes the same policy on to the page render, so Next applies the nonce", async () => {
      mockUser({ id: "u1" });
      const res = await proxy(makeRequest("/dashboard"));
      const sent = res.headers.get("content-security-policy");
      expect(sent).toContain("'nonce-");
      expect(res.headers.get("x-middleware-request-content-security-policy")).toBe(sent);
    });

    it("uses a different nonce on every request", async () => {
      mockUser(null);
      const a = await proxy(makeRequest("/"));
      const b = await proxy(makeRequest("/"));
      expect(nonceOf(a.headers.get("content-security-policy"))).not.toBe(
        nonceOf(b.headers.get("content-security-policy")),
      );
    });

    it("keeps the session cookies Supabase refreshes on the same response", async () => {
      vi.mocked(createServerClient).mockImplementation((_u, _k, opts) => {
        opts.cookies.setAll?.([{ name: "sb-refreshed", value: "v", options: {} }], {});
        return {
          auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }) },
        } as unknown as ReturnType<typeof createServerClient>;
      });
      const res = await proxy(makeRequest("/dashboard"));
      expect(res.cookies.get("sb-refreshed")?.value).toBe("v");
      expect(res.headers.get("content-security-policy")).toContain("'nonce-");
    });
  });

  describe("config export (v1.4.24-H / H-FE-2)", () => {
    it("exports a matcher so the proxy does not run on static assets", () => {
      expect(Array.isArray(config.matcher)).toBe(true);
      expect(String(config.matcher[0])).toContain("_next/static");
    });
  });
});
