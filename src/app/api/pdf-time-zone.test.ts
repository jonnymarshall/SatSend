import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// v1.5.28: both PDF downloads print payment times in the downloader's time
// zone, passed as ?tz= by the page; anything unrecognised falls back to UTC.

const mockRender = vi.fn(async () => Buffer.from("%PDF-test"));
vi.mock("@/lib/invoices/invoice-pdf", () => ({ renderInvoicePdf: (...a: unknown[]) => mockRender(...(a as [])) }));

const invoice = {
  id: "inv-1",
  user_id: "owner-1",
  invoice_number: "INV-1",
  your_name: "Sender",
  your_email: null,
  your_company: null,
  client_name: "Client",
  line_items: [],
  currency: "USD",
  status: "paid",
  access_code: null,
  created_at: "2026-04-20T10:00:00Z",
  updated_at: "2026-04-20T10:00:00Z",
  sent_at: null,
};

const mockFetchPublic = vi.fn();
vi.mock("@/lib/invoice-public", async (orig) => ({
  ...(await orig<typeof import("@/lib/invoice-public")>()),
  fetchPublicInvoice: (...a: unknown[]) => mockFetchPublic(...a),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

const single = vi.fn();
const eq: ReturnType<typeof vi.fn> = vi.fn(() => ({ eq, single }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner-1", email: "o@example.com" } } }) },
    from: () => ({ select: () => ({ eq }) }),
  }),
}));

async function publicPdf(query: string, headers: Record<string, string> = {}) {
  const { GET } = await import("./invoice/[id]/pdf/route");
  return GET(new NextRequest(`http://localhost/api/invoice/inv-1/pdf${query}`, { headers }), { params: Promise.resolve({ id: "inv-1" }) });
}
async function ownerPdf(query: string) {
  const { GET } = await import("./invoices/[id]/pdf/route");
  return GET(new NextRequest(`http://localhost/api/invoices/inv-1/pdf${query}`), { params: Promise.resolve({ id: "inv-1" }) });
}
const tzPassed = () => (mockRender.mock.lastCall as unknown as [unknown, { timeZone: string }])[1].timeZone;

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchPublic.mockResolvedValue(invoice);
  single.mockResolvedValue({ data: invoice, error: null });
});

describe("PDF time zone (v1.5.28)", () => {
  it.each([
    ["the public PDF", publicPdf],
    ["the owner's PDF", ownerPdf],
  ])("%s uses the ?tz= it's given", async (_label, get) => {
    await get("?tz=America%2FNew_York");
    expect(tzPassed()).toBe("America/New_York");
  });

  it.each([
    ["missing", ""],
    ["made up", "?tz=Mars%2FOlympus"],
  ])("falls back to UTC when the time zone is %s", async (_label, query) => {
    await publicPdf(query);
    expect(tzPassed()).toBe("UTC");
  });

  it("a different time zone is a different PDF, so the browser's cached copy isn't reused", async () => {
    const a = (await publicPdf("?tz=UTC")).headers.get("etag");
    const b = (await publicPdf("?tz=America%2FNew_York")).headers.get("etag");
    expect(a).not.toBe(b);
  });
});
