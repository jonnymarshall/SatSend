import { describe, it, expect, vi, beforeEach } from "vitest";

// v1.5.31: fetchPublicInvoice looks an invoice up by its SatSend reference or
// by its old UUID. A fake admin client records which column it was asked for.
const calls: { column: string; value: string }[] = [];
let row: Record<string, unknown> | null = null;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: (column: string, value: string) => {
          calls.push({ column, value });
          return { single: async () => (row ? { data: row, error: null } : { data: null, error: { code: "PGRST116" } }) };
        },
      }),
    }),
  }),
}));

import { fetchPublicInvoice, toPublicInvoice, type Invoice } from "./invoice-public";

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
  amount_received_fiat: null,
  amount_received_sats: null,
  btc_price_at_detection: null,
  email_attempted_at: null,
  mempool_seen_at: null,
  next_check_at: null,
  overpaid: false,
  payment_confirmed_at: null,
  pre_archive_status: null,
  published_at: null,
  send_method: null,
  sent_at: null,
  stage_attempt: 0,
  btc_price_at_seen: null,
  slippage_tolerance_fiat: null,
  payment_quote_id: null,
  reference: "7K3QX9AB",
};

describe("fetchPublicInvoice (v1.5.31)", () => {
  beforeEach(() => {
    calls.length = 0;
    row = { ...baseInvoice };
  });

  it("finds an invoice by its SatSend reference, however it was typed", async () => {
    for (const key of ["ss-7k3qx9ab", "SS-7K3QX9AB", "7k3qx9ab"]) {
      expect((await fetchPublicInvoice(key))?.id).toBe("inv-1");
    }
    expect(calls).toEqual(Array(3).fill({ column: "reference", value: "7K3QX9AB" }));
  });

  it("still finds an invoice by its old UUID link", async () => {
    const uuid = "653fe277-ecbb-47d4-9ea7-8a96c76d6494";
    await fetchPublicInvoice(uuid);
    expect(calls).toEqual([{ column: "id", value: uuid }]);
  });

  it("doesn't ask the database about a link that can't be an invoice", async () => {
    expect(await fetchPublicInvoice("not-a-uuid")).toBeNull();
    expect(calls).toEqual([]);
  });

  it("hides drafts and unknown invoices", async () => {
    row = { ...baseInvoice, status: "draft" };
    expect(await fetchPublicInvoice("ss-7k3qx9ab")).toBeNull();
    row = null;
    expect(await fetchPublicInvoice("ss-7k3qx9ab")).toBeNull();
  });
});

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
