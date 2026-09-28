import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { NextRequest } from "next/server";

// Mock Supabase admin
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
  eq: mockEq,
  single: mockSingle,
}));
const mockGetUserById = vi.fn().mockResolvedValue({
  data: { user: { id: "owner-1", email: "owner@example.com" } },
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    auth: { admin: { getUserById: (...args: unknown[]) => mockGetUserById(...args) } },
  }),
}));

const mockSendDetected = vi.fn().mockResolvedValue(undefined);
const mockSendConfirmed = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email/send", () => ({
  sendPaymentDetectedEmail: (...args: unknown[]) => mockSendDetected(...args),
  sendPaymentConfirmedEmail: (...args: unknown[]) => mockSendConfirmed(...args),
}));

// Mock mempool fetchTx / fetchTipHeight
const mockFetchTx = vi.fn();
const mockFetchTipHeight = vi.fn();
vi.mock("@/lib/mempool", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mempool")>("@/lib/mempool");
  return {
    ...actual,
    fetchTx: (...args: unknown[]) => mockFetchTx(...args),
    fetchTipHeight: (...args: unknown[]) => mockFetchTipHeight(...args),
  };
});

const mockFetchBtcPrice = vi.fn();
vi.mock("@/lib/btc-price", () => ({
  fetchBtcPrice: (...args: unknown[]) => mockFetchBtcPrice(...args),
}));

const mockCookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (...args: unknown[]) => mockCookieGet(...args) }),
}));

async function postRequest(invoiceId: string, body: object) {
  const { POST } = await import(
    "./[id]/payment-status/route"
  );
  const req = new NextRequest(`http://localhost/api/invoices/${invoiceId}/payment-status`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return POST(req, { params: Promise.resolve({ id: invoiceId }) });
}

const pendingInvoice = {
  id: "inv-1",
  btc_address: "tb1qtarget",
  status: "pending",
  user_id: "owner-1",
  invoice_number: "INV-PAY-1",
  client_name: "Ada",
  client_email: "payer@example.com",
  total_fiat: 250,
  currency: "USD",
  your_name: "Charles",
  your_company: null,
  your_email: "charles@example.com",
};

// 500,000 sats @ $50,000/BTC = $250 — matches pendingInvoice.total_fiat exactly
// so confirmed-and-finalized tests land on a clean "paid", not under/overpaid.
const matchingTx = {
  txid: "txabc",
  status: { confirmed: false },
  vout: [{ scriptpubkey_address: "tb1qtarget", value: 500000 }],
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mockFetchTipHeight.mockResolvedValue(900_001);
  mockFetchBtcPrice.mockResolvedValue({ price: 50_000, source: "coinbase" });
  mockCookieGet.mockReturnValue(undefined);
});

describe("POST /api/invoices/[id]/payment-status", () => {
  it("returns 400 when body is missing txid", async () => {
    const res = await postRequest("inv-1", { status: "payment_detected" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when status is invalid", async () => {
    const res = await postRequest("inv-1", { txid: "txabc", status: "draft" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when invoice not found", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
    const res = await postRequest("inv-1", { txid: "txabc", status: "payment_detected" });
    expect(res.status).toBe(404);
  });

  it("returns 400 when tx does not pay to invoice address", async () => {
    mockSingle.mockResolvedValueOnce({ data: pendingInvoice, error: null });
    mockFetchTx.mockResolvedValueOnce({
      txid: "txabc",
      status: { confirmed: false },
      vout: [{ scriptpubkey_address: "tb1qother", value: 50000 }],
    });
    const res = await postRequest("inv-1", { txid: "txabc", status: "payment_detected" });
    expect(res.status).toBe(400);
  });

  it("updates status to payment_detected for unconfirmed tx", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: pendingInvoice, error: null })
      .mockResolvedValueOnce({ data: { status: "payment_detected" }, error: null });
    mockFetchTx.mockResolvedValueOnce(matchingTx);
    mockUpdate.mockReturnValue({ eq: () => ({ eq: () => ({ select: () => ({ single: mockSingle }) }) }) });

    const res = await postRequest("inv-1", { txid: "txabc", status: "payment_detected" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("payment_detected");
  });

  it("returns 200 with requested status when DB row already changed (PGRST116)", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: pendingInvoice, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST116", message: "no rows" } });
    mockFetchTx.mockResolvedValueOnce(matchingTx);
    mockUpdate.mockReturnValue({ eq: () => ({ eq: () => ({ select: () => ({ single: mockSingle }) }) }) });

    const res = await postRequest("inv-1", { txid: "txabc", status: "payment_detected" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("payment_detected");
  });

  it("returns current status when already at or past requested status", async () => {
    mockSingle.mockResolvedValueOnce({ data: { ...pendingInvoice, status: "paid" }, error: null });
    const res = await postRequest("inv-1", { txid: "txabc", status: "payment_detected" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("paid");
  });

  it("dispatches a payment_detected email with both owner and payer addresses on a successful transition", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: pendingInvoice, error: null })
      .mockResolvedValueOnce({ data: { status: "payment_detected" }, error: null });
    mockFetchTx.mockResolvedValueOnce(matchingTx);
    mockUpdate.mockReturnValue({ eq: () => ({ eq: () => ({ select: () => ({ single: mockSingle }) }) }) });

    await postRequest("inv-1", { txid: "txabc", status: "payment_detected" });

    expect(mockSendDetected).toHaveBeenCalledTimes(1);
    expect(mockSendConfirmed).not.toHaveBeenCalled();
    expect(mockSendDetected).toHaveBeenCalledWith(expect.objectContaining({
      ownerEmail: "owner@example.com",
      payerEmail: "payer@example.com",
      userId: "owner-1",
      invoiceId: "inv-1",
      invoiceNumber: "INV-PAY-1",
      senderName: "Charles",
      clientName: "Ada",
      totalFiat: 250,
      currency: "USD",
      txid: "txabc",
    }));
  });

  it("dispatches a payment_confirmed email with both owner and payer addresses on a successful transition", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: pendingInvoice, error: null })
      .mockResolvedValueOnce({ data: { status: "paid" }, error: null });
    // Must be a REALLY confirmed tx at sufficient depth for the email to fire —
    // a claimed status alone (matchingTx is unconfirmed) is not enough.
    mockFetchTx.mockResolvedValueOnce({ ...matchingTx, status: { confirmed: true, block_height: 900_000 } });
    mockUpdate.mockReturnValue({ eq: () => ({ eq: () => ({ select: () => ({ single: mockSingle }) }) }) });

    await postRequest("inv-1", { txid: "txabc", status: "paid" });

    expect(mockSendConfirmed).toHaveBeenCalledTimes(1);
    expect(mockSendDetected).not.toHaveBeenCalled();
    expect(mockSendConfirmed).toHaveBeenCalledWith(expect.objectContaining({
      ownerEmail: "owner@example.com",
      payerEmail: "payer@example.com",
      userId: "owner-1",
      invoiceId: "inv-1",
      txid: "txabc",
    }));
  });

  it("rejects with 409 when current status is draft (v1.4.12 hotfix — never auto-flip a draft)", async () => {
    mockSingle.mockResolvedValueOnce({ data: { ...pendingInvoice, status: "draft" }, error: null });
    const res = await postRequest("inv-1", { txid: "txabc", status: "paid" });
    expect(res.status).toBe(409);
    // Status gate stops it before ever fetching the tx or writing the DB.
    expect(mockFetchTx).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSendConfirmed).not.toHaveBeenCalled();
    expect(mockSendDetected).not.toHaveBeenCalled();
  });

  it("rejects with 409 when current status is archived (v1.4.12 hotfix)", async () => {
    mockSingle.mockResolvedValueOnce({ data: { ...pendingInvoice, status: "archived" }, error: null });
    const res = await postRequest("inv-1", { txid: "txabc", status: "paid" });
    expect(res.status).toBe(409);
    expect(mockFetchTx).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("accepts a transition when current status is overdue (v1.4.12 hotfix — overdue is still payable)", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { ...pendingInvoice, status: "overdue" }, error: null })
      .mockResolvedValueOnce({ data: { status: "paid" }, error: null });
    mockFetchTx.mockResolvedValueOnce({ ...matchingTx, status: { confirmed: true, block_height: 900_000 } });
    mockUpdate.mockReturnValue({ eq: () => ({ eq: () => ({ select: () => ({ single: mockSingle }) }) }) });

    const res = await postRequest("inv-1", { txid: "txabc", status: "paid" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("paid");
  });

  it("passes payerEmail: null when client_email is blank", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { ...pendingInvoice, client_email: "" }, error: null })
      .mockResolvedValueOnce({ data: { status: "payment_detected" }, error: null });
    mockFetchTx.mockResolvedValueOnce(matchingTx);
    mockUpdate.mockReturnValue({ eq: () => ({ eq: () => ({ select: () => ({ single: mockSingle }) }) }) });

    await postRequest("inv-1", { txid: "txabc", status: "payment_detected" });

    expect(mockSendDetected).toHaveBeenCalledTimes(1);
    expect(mockSendDetected).toHaveBeenCalledWith(expect.objectContaining({
      ownerEmail: "owner@example.com",
      payerEmail: null,
    }));
  });

  describe("forgery regression (CRIT-4)", () => {
    it("a claimed status:'paid' does not move the invoice past payment_detected when the real tx is unconfirmed", async () => {
      // The real fetched tx is unconfirmed even though the client claims "paid".
      // Pre-fix, the route built a synthetic tx trusting the client's claim
      // instead of the real one — this is the regression test for that bug.
      mockSingle
        .mockResolvedValueOnce({ data: pendingInvoice, error: null })
        .mockResolvedValueOnce({ data: { status: "payment_detected" }, error: null });
      mockFetchTx.mockResolvedValueOnce(matchingTx); // matchingTx is unconfirmed
      mockUpdate.mockReturnValue({ eq: () => ({ eq: () => ({ select: () => ({ single: mockSingle }) }) }) });

      const res = await postRequest("inv-1", { txid: "txabc", status: "paid" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("payment_detected");
      expect(mockSendConfirmed).not.toHaveBeenCalled();
    });

    it("a real but underpaying confirmed tx lands on underpaid, not paid, even when the client claims 'paid'", async () => {
      mockSingle
        .mockResolvedValueOnce({ data: pendingInvoice, error: null }) // total_fiat: 250
        .mockResolvedValueOnce({ data: { status: "underpaid" }, error: null });
      // 50,000 sats @ $50,000/BTC = $25 — 10% of the $250 total.
      mockFetchTx.mockResolvedValueOnce({
        txid: "txabc",
        status: { confirmed: true, block_height: 900_000 },
        vout: [{ scriptpubkey_address: "tb1qtarget", value: 50_000 }],
      });
      mockUpdate.mockReturnValue({ eq: () => ({ eq: () => ({ select: () => ({ single: mockSingle }) }) }) });

      const res = await postRequest("inv-1", { txid: "txabc", status: "paid" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("underpaid");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "underpaid", amount_received_sats: 50_000 })
      );
    });
  });

  describe("access-code gate", () => {
    const gatedInvoice = { ...pendingInvoice, access_code: "secret123" };

    it("returns 404 when the invoice has an access code and no cookie is present", async () => {
      mockSingle.mockResolvedValueOnce({ data: gatedInvoice, error: null });
      mockCookieGet.mockReturnValue(undefined);

      const res = await postRequest("inv-1", { txid: "txabc", status: "payment_detected" });

      expect(res.status).toBe(404);
      expect(mockFetchTx).not.toHaveBeenCalled();
    });

    it("returns 404 when the invoice has an access code and the cookie value is wrong", async () => {
      mockSingle.mockResolvedValueOnce({ data: gatedInvoice, error: null });
      mockCookieGet.mockReturnValue({ value: "wrong-code" });

      const res = await postRequest("inv-1", { txid: "txabc", status: "payment_detected" });

      expect(res.status).toBe(404);
    });

    it("accepts the request when the access-code cookie matches", async () => {
      mockSingle
        .mockResolvedValueOnce({ data: gatedInvoice, error: null })
        .mockResolvedValueOnce({ data: { status: "payment_detected" }, error: null });
      mockCookieGet.mockReturnValue({ value: "secret123" });
      mockFetchTx.mockResolvedValueOnce(matchingTx);
      mockUpdate.mockReturnValue({ eq: () => ({ eq: () => ({ select: () => ({ single: mockSingle }) }) }) });

      const res = await postRequest("inv-1", { txid: "txabc", status: "payment_detected" });

      expect(res.status).toBe(200);
    });
  });
});
