import { describe, it, expect } from "vitest";
import { toPublicInvoice, type Invoice } from "./invoice-public";

const baseInvoice: Invoice = {
  id: "inv-1",
  user_id: "user-abc",
  invoice_number: "INV-001",
  your_name: "Alice",
  your_email: "alice@example.com",
  your_company: "Alice Co",
  your_address: "1 Main St",
  your_tax_id: "TAX-1",
  client_name: "Bob",
  client_email: "bob@example.com",
  client_company: "Bob Co",
  client_address: "2 Main St",
  client_tax_id: "TAX-2",
  line_items: [{ description: "Widget", quantity: 1, unit_price: 10 }],
  subtotal_fiat: 10,
  tax_fiat: 0,
  tax_percent: 0,
  total_fiat: 10,
  currency: "USD",
  btc_address: "bc1qexampleaddress",
  btc_txid: null,
  status: "pending",
  access_code: "secret123",
  due_date: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("toPublicInvoice", () => {
  it("strips access_code and user_id before the invoice crosses to the client", () => {
    const publicInvoice = toPublicInvoice(baseInvoice);

    expect(publicInvoice).not.toHaveProperty("access_code");
    expect(publicInvoice).not.toHaveProperty("user_id");
  });

  it("keeps every other field intact", () => {
    const publicInvoice = toPublicInvoice(baseInvoice);

    expect(publicInvoice.status).toBe("pending");
    expect(publicInvoice.total_fiat).toBe(10);
    expect(publicInvoice.client_name).toBe("Bob");
    expect(publicInvoice.btc_address).toBe("bc1qexampleaddress");
  });
});
