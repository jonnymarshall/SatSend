import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }),
}));

import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/auth/signup-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/auth/signup-check (v1.5.14)", () => {
  it("answers registered: true for an email with an account", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    const res = await post({ email: "Ada@Example.com " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ registered: true });
    expect(mockRpc).toHaveBeenCalledWith("is_email_registered", { p_email: "ada@example.com" });
  });

  it("answers registered: false for a new email", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    const res = await post({ email: "new@example.com" });
    expect(await res.json()).toEqual({ registered: false });
  });

  it.each([[{}], [{ email: "" }], [{ email: "not-an-email" }], [{ email: 42 }], ["not json"]])(
    "rejects %j with 400 without asking the database",
    async (body) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(mockRpc).not.toHaveBeenCalled();
    },
  );

  it("fails loudly (503) when the database can't answer", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "down" } });
    const res = await post({ email: "new@example.com" });
    expect(res.status).toBe(503);
  });
});
