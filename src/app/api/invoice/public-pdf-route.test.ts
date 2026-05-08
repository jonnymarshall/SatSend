import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockFetchPublic = vi.fn();
vi.mock("@/lib/invoice-public", () => ({
  fetchPublicInvoice: (...args: unknown[]) => mockFetchPublic(...args),
}));

async function getRequest(invoiceId: string) {
  const { GET } = await import("./[id]/pdf/route");
  const req = new NextRequest(`http://localhost/api/invoice/${invoiceId}/pdf`, {
    method: "GET",
  });
  return GET(req, { params: Promise.resolve({ id: invoiceId }) });
}

const publishedInvoice = {
  id: "inv-1",
  user_id: "owner-1",
  invoice_number: "INV-PUB-001",
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

describe("GET /api/invoice/[id]/pdf (public, unauthenticated)", () => {
  it("returns 404 when the invoice does not exist or is a draft", async () => {
    mockFetchPublic.mockResolvedValueOnce(null);
    const res = await getRequest("missing");
    expect(res.status).toBe(404);
  });

  it("returns a PDF for a published invoice without requiring auth", async () => {
    mockFetchPublic.mockResolvedValueOnce(publishedInvoice);
    const res = await getRequest("inv-1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("uses the same <sender>_<invoiceName>_<YYYYMMDD>.pdf filename format as the owner endpoint", async () => {
    mockFetchPublic.mockResolvedValueOnce(publishedInvoice);
    const res = await getRequest("inv-1");
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toContain('filename="Sender_INV-PUB-001_20260420.pdf"');
  });
});
