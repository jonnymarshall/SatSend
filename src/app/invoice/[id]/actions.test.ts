import { describe, it, expect, vi, beforeEach } from "vitest";
import { accessToken } from "@/lib/access-code";

const mockFetchPublic = vi.fn();
vi.mock("@/lib/invoice-public", () => ({
  fetchPublicInvoice: (...args: unknown[]) => mockFetchPublic(...args),
}));

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }),
}));

const mockCookieSet = vi.fn();
let requestHeaders = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: (...a: unknown[]) => mockCookieSet(...a) }),
  headers: async () => requestHeaders,
}));

class Redirect extends Error {
  constructor(public url: string) {
    super(`redirect ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));

import { verifyAccessCode } from "./actions";

const ID = "11111111-1111-1111-1111-111111111111";
const gated = { id: ID, access_code: "SECRET1" };

function guess(code: string, id = ID) {
  const form = new FormData();
  form.set("access_code", code);
  return verifyAccessCode(id, { error: undefined }, form);
}

/** The limit's answer: allowed by default. */
function limitAnswers({ allowed = true, error = null as unknown } = {}) {
  mockRpc.mockResolvedValue({ data: error ? null : allowed, error });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  requestHeaders = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
  mockFetchPublic.mockResolvedValue(gated);
  limitAnswers();
});

describe("verifyAccessCode (v1.5.26: guess limit)", () => {
  it("the right code sets a fingerprint cookie, never the code, and opens the invoice", async () => {
    await expect(guess("secret1")).rejects.toThrow(`redirect /invoice/${ID}`);
    const [name, value, options] = mockCookieSet.mock.calls[0];
    expect(name).toBe(`pb_access_${ID}`);
    expect(value).toBe(accessToken(ID, "SECRET1"));
    expect(value).not.toMatch(/secret1/i);
    expect(options).toMatchObject({ httpOnly: true, path: "/" });
  });

  it("asks the limit about every guess, recording only wrong ones", async () => {
    await expect(guess("secret1")).rejects.toThrow();
    expect(mockRpc).toHaveBeenLastCalledWith("take_access_code_guess", {
      p_invoice_id: ID,
      p_client_key: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_wrong: false,
      p_limit: 5,
      p_window_seconds: 900,
    });

    expect(await guess("WRONG1")).toEqual({ error: "Incorrect access code. Please try again." });
    expect(mockRpc.mock.lastCall![1]).toMatchObject({ p_wrong: true });
    expect(mockCookieSet).toHaveBeenCalledTimes(1);
  });

  it("never stores the raw IP", async () => {
    await guess("WRONG1");
    expect(JSON.stringify(mockRpc.mock.calls)).not.toContain("203.0.113.7");
  });

  it("once the limit is reached, refuses every guess, the right one included", async () => {
    limitAnswers({ allowed: false });
    const tooMany = { error: "Too many wrong tries. Please wait 15 minutes and try again." };
    expect(await guess("WRONG1")).toEqual(tooMany);
    expect(await guess("secret1")).toEqual(tooMany);
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("counts each invoice separately", async () => {
    await guess("WRONG1");
    await guess("WRONG1", "22222222-2222-2222-2222-222222222222");
    const invoices = mockRpc.mock.calls.map(([, args]) => (args as { p_invoice_id: string }).p_invoice_id);
    expect(new Set(invoices).size).toBe(2);
  });

  it("fails closed if the limit can't be checked", async () => {
    limitAnswers({ error: { message: "db down" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await guess("secret1")).toEqual({ error: "We couldn't check that code. Please try again." });
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("an invoice without a code just opens, without touching the limit", async () => {
    mockFetchPublic.mockResolvedValue({ id: ID, access_code: null });
    await expect(guess("")).rejects.toThrow(`redirect /invoice/${ID}`);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it("an unknown invoice goes home", async () => {
    mockFetchPublic.mockResolvedValue(null);
    await expect(guess("x")).rejects.toThrow("redirect /");
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
