import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import InvoicesPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/invoices",
}));
vi.mock("./bulk-actions", () => ({
  bulkArchive: vi.fn(),
  bulkDelete: vi.fn(),
  bulkMarkPaid: vi.fn(),
}));
vi.mock("./use-invoice-realtime", () => ({
  useInvoiceRealtime: vi.fn(),
}));

const MOCK_INVOICES = [
  {
    id: "1",
    invoice_number: "INV-001",
    client_name: "Acme Corp",
    total_fiat: 2500,
    currency: "USD",
    status: "pending",
    created_at: "2026-04-01T00:00:00Z",
    due_date: "2026-04-30",
  },
  {
    id: "2",
    invoice_number: "INV-002",
    client_name: "Globex",
    total_fiat: 500,
    currency: "USD",
    status: "paid",
    created_at: "2026-04-02T00:00:00Z",
    due_date: null,
  },
];

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "u1", email: "test@example.com" } },
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: MOCK_INVOICES }),
    })),
  }),
}));

describe("InvoicesPage", () => {
  it("renders the invoices heading", async () => {
    render(await InvoicesPage());
    expect(screen.getByRole("heading", { name: /invoices/i })).toBeInTheDocument();
  });

  it("shows a New Invoice link", async () => {
    render(await InvoicesPage());
    expect(screen.getByRole("link", { name: /new invoice/i })).toBeInTheDocument();
  });

  it("renders invoice numbers and client names", async () => {
    render(await InvoicesPage());
    expect(screen.getByText("INV-001")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("INV-002")).toBeInTheDocument();
  });

  it("shows formatted due date in the Due Date column", async () => {
    render(await InvoicesPage());
    expect(screen.getByText(/apr(il)? 30,? 2026/i)).toBeInTheDocument();
  });

  it("shows a dash when invoice has no due_date", async () => {
    render(await InvoicesPage());
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("shows empty state when there are no invoices", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [] }),
      })),
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    render(await InvoicesPage());
    expect(screen.getByText(/no invoices yet/i)).toBeInTheDocument();
  });
});
