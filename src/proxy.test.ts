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

  describe("config export (v1.4.24-H / H-FE-2)", () => {
    it("exports a matcher so the proxy does not run on static assets", () => {
      expect(Array.isArray(config.matcher)).toBe(true);
      expect(String(config.matcher[0])).toContain("_next/static");
    });
  });
});
