import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }),
}));

import { POST } from "./route";

function post(body: unknown, ip = "203.0.113.7") {
  return POST(
    new NextRequest("http://localhost/api/auth/signup-check", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

/** Default: under the limit, and the email lookup answers `registered`. */
function rpcAnswers({ allowed = true, registered = false, limitError = null as unknown, lookupError = null as unknown } = {}) {
  mockRpc.mockImplementation(async (fn: string) => {
    if (fn === "take_signup_check") return { data: limitError ? null : allowed, error: limitError };
    if (fn === "is_email_registered") return { data: lookupError ? null : registered, error: lookupError };
    throw new Error(`unexpected rpc ${fn}`);
  });
}

const calls = (fn: string) => mockRpc.mock.calls.filter(([name]) => name === fn);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  rpcAnswers();
});

describe("POST /api/auth/signup-check (v1.5.14)", () => {
  it("answers registered: true for an email with an account", async () => {
    rpcAnswers({ registered: true });
    const res = await post({ email: "Ada@Example.com " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ registered: true });
    expect(calls("is_email_registered")[0][1]).toEqual({ p_email: "ada@example.com" });
  });

  it("answers registered: false for a new email", async () => {
    const res = await post({ email: "new@example.com" });
    expect(await res.json()).toEqual({ registered: false });
  });

  it.each([[{}], [{ email: "" }], [{ email: "not-an-email" }], [{ email: 42 }], ["not json"]])(
    "rejects %j with 400 without touching the database (and without using up an attempt)",
    async (body) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(mockRpc).not.toHaveBeenCalled();
    },
  );

  it("fails loudly (503) when the database can't answer", async () => {
    rpcAnswers({ lookupError: { message: "down" } });
    const res = await post({ email: "new@example.com" });
    expect(res.status).toBe(503);
  });
});

describe("POST /api/auth/signup-check — 5 an hour per connection (v1.5.15)", () => {
  it("asks for 5 per 3600 seconds before looking the email up", async () => {
    await post({ email: "new@example.com" });
    expect(calls("take_signup_check")).toHaveLength(1);
    const [, args] = calls("take_signup_check")[0];
    expect(args).toMatchObject({ p_limit: 5, p_window_seconds: 3600 });
    const order = mockRpc.mock.calls.map(([name]) => name);
    expect(order).toEqual(["take_signup_check", "is_email_registered"]);
  });

  it("over the limit: 429 and the email is not looked up", async () => {
    rpcAnswers({ allowed: false, registered: true });
    const res = await post({ email: "ada@example.com" });
    expect(res.status).toBe(429);
    expect(calls("is_email_registered")).toHaveLength(0);
  });

  it("keys on a scrambled fingerprint of the caller's address, never the address itself", async () => {
    await post({ email: "a@example.com" }, "203.0.113.7");
    await post({ email: "b@example.com" }, "203.0.113.7");
    await post({ email: "c@example.com" }, "198.51.100.9");
    const keys = calls("take_signup_check").map(([, args]) => (args as { p_client_key: string }).p_client_key);
    expect(keys[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(keys[0]).not.toContain("203.0.113.7");
    expect(keys[1]).toBe(keys[0]); // same connection, same bucket
    expect(keys[2]).not.toBe(keys[0]); // another connection, its own bucket
  });

  it("if the limit can't be checked, fails closed (503) and doesn't look the email up", async () => {
    rpcAnswers({ limitError: { message: "down" } });
    const res = await post({ email: "new@example.com" });
    expect(res.status).toBe(503);
    expect(calls("is_email_registered")).toHaveLength(0);
  });
});
