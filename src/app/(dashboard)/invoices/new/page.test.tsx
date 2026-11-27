import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// v1.5.34 (roadmap v1.4.25): Duplicate opens /invoices/new?from=<ref> (v1.5.38:
// the SatSend reference, was the UUID). The page
// fills the form from the original, only if it's the signed-in sender's own,
// and writes nothing to the database.

const formProps = vi.fn();
vi.mock("@/components/invoice-form", () => ({
  InvoiceForm: (props: unknown) => {
    formProps(props);
    return <div data-testid="invoice-form" />;
  },
}));

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  redirect: (url: string) => redirect(url),
}));

const SOURCE = {
  id: "inv-src",
  reference: "7K3QX9AB",
  user_id: "user-1",
  status: "paid",
  invoice_number: "INV-001",
  your_name: "Freelancer",
  your_email: "me@example.com",
  your_company: null,
  your_tax_id: null,
  client_name: "Acme",
  client_email: "acme@example.com",
  client_company: null,
  client_tax_id: null,
  line_items: [{ description: "Work", quantity: 1, unit_price: 1000 }],
  tax_percent: 0,
  btc_address: "bc1qshouldnotcopy",
  btc_txid: "txid",
  due_date: null,
  access_code: "LETMEIN1",
};

let sourceRow: object | null = SOURCE;
let lastInvoice: { currency: string } | null = { currency: "EUR" };
const calls: string[] = [];
const insert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1", email: "me@example.com" } } })) },
    from: () => ({
      insert,
      update: insert,
      delete: insert,
      select: (cols: string) => {
        calls.push(`select ${cols}`);
        const chain = {
          eq: (col: string, val: string) => {
            calls.push(`eq ${col}=${val}`);
            return chain;
          },
          order: () => chain,
          limit: () => chain,
          not: async () => ({ data: [{ invoice_number: "INV-001 (copy)" }], error: null }),
          maybeSingle: async () => ({ data: cols === "currency" ? lastInvoice : sourceRow, error: null }),
        };
        return chain;
      },
    }),
  })),
}));

import NewInvoicePage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  sourceRow = SOURCE;
  lastInvoice = { currency: "EUR" };
});

describe("New Invoice page", () => {
  it("without ?from, shows an empty form in your last invoice's currency (R-44)", async () => {
    render(await NewInvoicePage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("invoice-form")).toBeInTheDocument();
    expect(formProps.mock.calls[0][0]).not.toHaveProperty("initialValues");
    expect(formProps.mock.calls[0][0]).toMatchObject({ defaultCurrency: "EUR" });
    expect(calls).toEqual(["select currency", "eq user_id=user-1"]);
  });

  it("with no invoices yet, the form starts in USD", async () => {
    lastInvoice = null;
    render(await NewInvoicePage({ searchParams: Promise.resolve({}) }));
    expect(formProps.mock.calls[0][0]).toMatchObject({ defaultCurrency: "USD" });
  });

  it("with ?from, fills the form from the sender's own invoice and saves nothing", async () => {
    render(await NewInvoicePage({ searchParams: Promise.resolve({ from: "ss-7k3qx9ab" }) }));
    const props = formProps.mock.calls[0][0] as { invoiceId?: string; initialValues: Record<string, unknown> };
    expect(props.invoiceId).toBeUndefined();
    expect(props.initialValues).toMatchObject({
      invoice_number: "INV-001 (copy 2)",
      client_name: "Acme",
      access_code: "LETMEIN1",
      btc_address: "",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("only loads an invoice that belongs to the signed-in sender", async () => {
    await NewInvoicePage({ searchParams: Promise.resolve({ from: "ss-7k3qx9ab" }) });
    expect(calls).toContain("eq reference=7K3QX9AB");
    expect(calls).toContain("eq user_id=user-1");
  });

  it("an old ?from=<uuid> link still works", async () => {
    await NewInvoicePage({ searchParams: Promise.resolve({ from: "0b1e7c2a-1111-4222-8333-444455556666" }) });
    expect(calls).toContain("eq id=0b1e7c2a-1111-4222-8333-444455556666");
  });

  it("says where the copy came from", async () => {
    render(await NewInvoicePage({ searchParams: Promise.resolve({ from: "ss-7k3qx9ab" }) }));
    expect(document.getElementById("invoice-form-page--copied-from")).toHaveTextContent("INV-001");
  });

  it("an invoice that isn't the sender's (or doesn't exist) is not found", async () => {
    sourceRow = null;
    await expect(NewInvoicePage({ searchParams: Promise.resolve({ from: "someone-elses" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(insert).not.toHaveBeenCalled();
  });
});
