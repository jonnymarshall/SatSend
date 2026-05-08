import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockEqChain: ReturnType<typeof vi.fn> = vi.fn(() => ({
  eq: mockEqChain,
  single: mockSingle,
}));
const mockSelect = vi.fn(() => ({ eq: mockEqChain }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

async function getRequest(invoiceId: string) {
  const { GET } = await import("./[id]/pdf/route");
  const req = new NextRequest(`http://localhost/api/invoices/${invoiceId}/pdf`, {
    method: "GET",
  });
  return GET(req, { params: Promise.resolve({ id: invoiceId }) });
}

const ownerInvoice = {
  id: "inv-1",
  user_id: "owner-1",
  invoice_number: "INV-DL-001",
  your_name: "Sender",
  your_email: "s@example.com",
  your_company: null,
  your_address: null,
  your_tax_id: null,
  client_name: "Client",
  client_email: "c@example.com",
  client_company: null,
  client_address: null,
  client_tax_id: null,
  line_items: [{ description: "Work", quantity: 1, unit_price: 100 }],
  subtotal_fiat: 100,
  tax_fiat: 0,
  tax_percent: 0,
  total_fiat: 100,
  currency: "USD",
  btc_address: null,
  btc_txid: null,
  status: "pending",
  access_code: null,
  due_date: null,
  created_at: "2026-04-20T10:00:00Z",
  updated_at: "2026-04-20T10:00:00Z",
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/invoices/[id]/pdf", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await getRequest("inv-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when invoice does not exist or belongs to another user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "owner-1" } } });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
    const res = await getRequest("inv-missing");
    expect(res.status).toBe(404);
  });

  it("scopes the lookup to both the invoice id and the authenticated user_id (no leakage)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "owner-1" } } });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
    await getRequest("inv-1");

    const eqCalls = mockEqChain.mock.calls as Array<[string, unknown]>;
    const filterMap = Object.fromEntries(eqCalls.map((args) => [args[0], args[1]]));
    expect(filterMap).toMatchObject({ id: "inv-1", user_id: "owner-1" });
  });

  it("returns a PDF for the authorized owner", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "owner-1" } } });
    mockSingle.mockResolvedValueOnce({ data: ownerInvoice, error: null });

    const res = await getRequest("inv-1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");

    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("sets a filename on the Content-Disposition header using <sender>_<invoiceName>_<YYYYMMDD>.pdf", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "owner-1" } } });
    mockSingle.mockResolvedValueOnce({ data: ownerInvoice, error: null });

    const res = await getRequest("inv-1");
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain('filename="Sender_INV-DL-001_20260420.pdf"');
  });

  it("falls back to the short id when invoice_number is null (UTF-8 encoded for the unicode ellipsis)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "owner-1" } } });
    mockSingle.mockResolvedValueOnce({
      data: { ...ownerInvoice, invoice_number: null, id: "abcd1234efgh5678ijkl9012mnop3456" },
      error: null,
    });

    const res = await getRequest("inv-1");
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toContain("filename*=UTF-8''Sender_%E2%80%A6mnop3456_20260420.pdf");
    expect(disposition).toContain('filename="Sender__mnop3456_20260420.pdf"');
  });

  it("falls back to the authenticated user's email when invoice has no your_company/your_name/your_email", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "owner-1", email: "jonnymarshall5@example.com" } },
    });
    mockSingle.mockResolvedValueOnce({
      data: {
        ...ownerInvoice,
        invoice_number: "TEST 4 02",
        your_company: null,
        your_name: null,
        your_email: null,
      },
      error: null,
    });

    const res = await getRequest("inv-1");
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toContain('filename="jonnymarshall5_TEST_4_02_20260420.pdf"');
  });
});
