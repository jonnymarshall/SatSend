import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { accessToken } from "@/lib/access-code";

// v1.5.29 (roadmap v1.5.2.22-H): "Pay now in Bitcoin" asks this route for a
// quote, the bitcoin amount the QR shows, held for 30 minutes.

const mockSingle = vi.fn();
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: mockSingle }) }) }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

const mockFetchBtcPrice = vi.fn();
vi.mock("@/lib/btc-price", () => ({ fetchBtcPrice: (...a: unknown[]) => mockFetchBtcPrice(...a) }));

const mockCookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (...a: unknown[]) => mockCookieGet(...a) }),
}));

const INVOICE = {
  id: "inv-1",
  status: "pending",
  btc_address: "tb1qtarget",
  total_fiat: 250,
  currency: "USD",
  access_code: null,
};

const QUOTE_ROW = {
  id: "q-1",
  invoice_id: "inv-1",
  amount_sats: 500_000,
  btc_price: 50_000,
  total_fiat: 250,
  currency: "USD",
  created_at: "2026-10-28T12:00:00Z",
  expires_at: "2026-10-28T12:30:00Z",
};

async function post(id = "inv-1") {
  const { POST } = await import("./[id]/quote/route");
  const req = new NextRequest(`http://localhost/api/invoices/${id}/quote`, { method: "POST" });
  return POST(req, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockSingle.mockResolvedValue({ data: INVOICE, error: null });
  mockFetchBtcPrice.mockResolvedValue({ price: 50_000, source: "coinbase" });
  mockRpc.mockResolvedValue({ data: [QUOTE_ROW], error: null });
  mockCookieGet.mockReturnValue(undefined);
});

describe("POST /api/invoices/[id]/quote", () => {
  it("records a quote at the current price and returns it", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      amountSats: 500_000,
      btcPrice: 50_000,
      expiresAt: "2026-10-28T12:30:00Z",
    });
    expect(mockRpc).toHaveBeenCalledWith("take_invoice_quote", {
      p_invoice_id: "inv-1",
      p_amount_sats: 500_000,
      p_btc_price: 50_000,
      p_total_fiat: 250,
      p_currency: "USD",
      p_valid_seconds: 1800,
      p_reuse_seconds: 60,
      p_keep_seconds: 86_400,
    });
  });

  it("returns the stored quote, which may be one already handed out", async () => {
    mockRpc.mockResolvedValue({ data: [{ ...QUOTE_ROW, amount_sats: 499_000, btc_price: 50_100 }], error: null });
    const body = await (await post()).json();
    expect(body.amountSats).toBe(499_000);
    expect(body.btcPrice).toBe(50_100);
  });

  it("is never cached", async () => {
    expect((await post()).headers.get("cache-control")).toBe("no-store");
  });

  it("answers 404 for an unknown invoice", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });
    expect((await post()).status).toBe(404);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("answers 404 for a protected invoice without its access code", async () => {
    mockSingle.mockResolvedValue({ data: { ...INVOICE, access_code: "secret123" }, error: null });
    expect((await post()).status).toBe(404);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("gives a quote for a protected invoice once the access code was entered", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    mockSingle.mockResolvedValue({ data: { ...INVOICE, access_code: "secret123" }, error: null });
    mockCookieGet.mockReturnValue({ value: accessToken("inv-1", "secret123") });
    expect((await post()).status).toBe(200);
  });

  it.each(["draft", "payment_detected", "paid", "underpaid", "archived"])(
    "answers 409 for a %s invoice: only an invoice awaiting payment gets a quote",
    async (status) => {
      mockSingle.mockResolvedValue({ data: { ...INVOICE, status }, error: null });
      expect((await post()).status).toBe(409);
      expect(mockRpc).not.toHaveBeenCalled();
    },
  );

  it("an overdue invoice gets a quote", async () => {
    mockSingle.mockResolvedValue({ data: { ...INVOICE, status: "overdue" }, error: null });
    expect((await post()).status).toBe(200);
  });

  it("answers 503 when the price is unavailable", async () => {
    mockFetchBtcPrice.mockRejectedValue(new Error("down"));
    expect((await post()).status).toBe(503);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("answers 503 when the quote can't be stored", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await post()).status).toBe(503);
  });
});
