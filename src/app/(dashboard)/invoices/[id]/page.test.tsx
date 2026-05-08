import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import InvoiceDetailPage from "./page";

const BASE_INVOICE = {
  id: "inv-abc",
  user_id: "u1",
  invoice_number: "INV-001",
  your_name: null,
  your_email: null,
  your_company: null,
  your_address: null,
  your_tax_id: null,
  client_name: "Acme Corp",
  client_email: "acme@example.com",
  client_company: null,
  client_address: null,
  client_tax_id: null,
  line_items: [{ description: "Design work", quantity: 1, unit_price: 1000 }],
  subtotal_fiat: 1000,
  tax_fiat: 0,
  tax_percent: 0,
  total_fiat: 1000,
  currency: "USD",
  btc_address: null as string | null,
  btc_txid: null as string | null,
  status: "pending",
  access_code: null,
  due_date: "2026-05-15" as string | null,
  created_at: "2026-04-15T12:00:00Z",
  updated_at: "2026-04-15T12:00:00Z",
};

function makeSupabaseMock(invoiceData: typeof BASE_INVOICE) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: invoiceData }),
    })),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  // Lazy default-impl: vi.mock is hoisted, BASE_INVOICE is in TDZ at hoist time.
  createClient: vi.fn(async () => makeSupabaseMock(BASE_INVOICE)),
}));

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/lib/btc-network", () => ({ getMempoolBaseUrl: () => "https://mempool.space" }));
vi.mock("./invoice-actions", () => ({ InvoiceActions: () => null }));
vi.mock("./invoice-detail-realtime", () => ({ InvoiceDetailRealtime: () => null }));
vi.mock("./invoice-activity-card", () => ({ InvoiceActivityCard: () => null }));

const mockPaymentWatcher = vi.fn();
vi.mock("@/app/invoice/[id]/payment-watcher-uncontrolled", () => ({
  PaymentWatcherUncontrolled: (props: Record<string, unknown>) => {
    mockPaymentWatcher(props);
    return null;
  },
}));

describe("InvoiceDetailPage — dates", () => {
  it("shows 'Date Sent:' label with formatted date", async () => {
    render(await InvoiceDetailPage({ params: Promise.resolve({ id: "inv-abc" }) }));
    expect(screen.getByText(/date sent:/i)).toBeInTheDocument();
    expect(screen.getByText(/apr(il)? 15,? 2026/i)).toBeInTheDocument();
  });

  it("shows 'Date Due:' label with formatted date when due_date is present", async () => {
    render(await InvoiceDetailPage({ params: Promise.resolve({ id: "inv-abc" }) }));
    expect(screen.getByText(/date due:/i)).toBeInTheDocument();
    expect(screen.getByText(/may 15,? 2026/i)).toBeInTheDocument();
  });

  it("shows 'No due date' when due_date is null", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({ ...BASE_INVOICE, due_date: null }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    render(await InvoiceDetailPage({ params: Promise.resolve({ id: "inv-abc" }) }));
    expect(screen.getByText(/no due date/i)).toBeInTheDocument();
  });
});

describe("InvoiceDetailPage — PaymentWatcher gating (v1.4.12 hotfix)", () => {
  beforeEach(() => mockPaymentWatcher.mockClear());

  it("does NOT mount PaymentWatcher for a draft with a BTC address", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        ...BASE_INVOICE,
        status: "draft",
        btc_address: "tb1qtest",
      }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    render(await InvoiceDetailPage({ params: Promise.resolve({ id: "inv-abc" }) }));
    expect(mockPaymentWatcher).not.toHaveBeenCalled();
  });

  it("does NOT mount PaymentWatcher for an archived invoice", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        ...BASE_INVOICE,
        status: "archived",
        btc_address: "tb1qtest",
      }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    render(await InvoiceDetailPage({ params: Promise.resolve({ id: "inv-abc" }) }));
    expect(mockPaymentWatcher).not.toHaveBeenCalled();
  });

  it("DOES mount PaymentWatcher for a pending invoice with a BTC address", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        ...BASE_INVOICE,
        status: "pending",
        btc_address: "tb1qtest",
      }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    render(await InvoiceDetailPage({ params: Promise.resolve({ id: "inv-abc" }) }));
    expect(mockPaymentWatcher).toHaveBeenCalledTimes(1);
  });

  it("DOES mount PaymentWatcher for an overdue invoice (still payable)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce(
      makeSupabaseMock({
        ...BASE_INVOICE,
        status: "overdue",
        btc_address: "tb1qtest",
      }) as unknown as Awaited<ReturnType<typeof createClient>>,
    );
    render(await InvoiceDetailPage({ params: Promise.resolve({ id: "inv-abc" }) }));
    expect(mockPaymentWatcher).toHaveBeenCalledTimes(1);
  });
});

