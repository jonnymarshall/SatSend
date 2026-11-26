import { describe, it, expect } from "vitest";
import { buildDuplicateInvoiceNumber, duplicateFormValues } from "./duplicate";

// v1.5.34 (roadmap v1.4.25): duplicating opens the New Invoice form filled in
// from the original; nothing is saved until the sender saves. These helpers
// build what the form starts with.

describe("buildDuplicateInvoiceNumber (moved from actions.ts; v1.4.23-H rules)", () => {
  it('appends " (copy)" to a short number', () => {
    expect(buildDuplicateInvoiceNumber("INV-001", new Set())).toBe("INV-001 (copy)");
  });

  it("returns null for an invoice without a number", () => {
    expect(buildDuplicateInvoiceNumber(null, new Set())).toBeNull();
    expect(buildDuplicateInvoiceNumber("", new Set())).toBeNull();
  });

  it('skips to " (copy 2)" and " (copy 3)" when earlier copies are taken', () => {
    expect(buildDuplicateInvoiceNumber("INV-001", new Set(["INV-001 (copy)"]))).toBe("INV-001 (copy 2)");
    expect(buildDuplicateInvoiceNumber("INV-001", new Set(["INV-001 (copy)", "INV-001 (copy 2)"]))).toBe(
      "INV-001 (copy 3)",
    );
  });

  it("fits the 30-character limit: 23 characters is untouched, 30 is trimmed", () => {
    const a23 = "A".repeat(23);
    expect(buildDuplicateInvoiceNumber(a23, new Set())).toBe(`${a23} (copy)`);
    const s30 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ-123";
    const out = buildDuplicateInvoiceNumber(s30, new Set())!;
    expect(out).toBe(`${s30.slice(0, 23)} (copy)`);
    expect(out.length).toBe(30);
  });
});

describe("duplicateFormValues", () => {
  const SOURCE = {
    invoice_number: "INV-001",
    your_name: "Freelancer",
    your_email: "me@example.com",
    your_company: "My Co",
    your_address_line1: "1 Street",
    your_address_country: "GB",
    your_tax_id: "TAX-1",
    client_name: "Acme",
    client_email: "acme@example.com",
    client_company: "Acme Co",
    client_address_line1: "2 Street",
    client_address_postcode: "10001",
    client_tax_id: "TAX-2",
    line_items: [{ description: "Work", quantity: 2, unit_price: 500 }],
    tax_percent: 10,
    btc_address: "bc1qshouldnotcopy",
    due_date: "2026-06-01",
    access_code: "LETMEIN1",
  };

  it("copies the sender, client, line items, tax, due date and access code", () => {
    const v = duplicateFormValues(SOURCE, new Set());
    expect(v).toMatchObject({
      your_name: "Freelancer",
      your_company: "My Co",
      your_address_line1: "1 Street",
      your_address_country: "GB",
      your_address_line2: "",
      your_tax_id: "TAX-1",
      client_name: "Acme",
      client_email: "acme@example.com",
      client_company: "Acme Co",
      client_address_line1: "2 Street",
      client_address_postcode: "10001",
      client_address_city: "",
      client_tax_id: "TAX-2",
      line_items: [{ description: "Work", quantity: 2, unit_price: 500 }],
      tax_percent: "10",
      access_code: "LETMEIN1",
      no_due_date: false,
    });
    expect(v.due_date?.toISOString().slice(0, 10)).toBe("2026-06-01");
  });

  it("never copies the receiving address: each invoice needs a fresh one", () => {
    expect(duplicateFormValues(SOURCE, new Set()).btc_address).toBe("");
  });

  it("gives the copy the next free invoice number", () => {
    expect(duplicateFormValues(SOURCE, new Set(["INV-001 (copy)"])).invoice_number).toBe("INV-001 (copy 2)");
    expect(duplicateFormValues({ ...SOURCE, invoice_number: null }, new Set()).invoice_number).toBe("");
  });

  it("an original with no due date gives a copy with no due date", () => {
    const v = duplicateFormValues({ ...SOURCE, due_date: null }, new Set());
    expect(v.due_date).toBeUndefined();
    expect(v.no_due_date).toBe(true);
  });

  it("a 0% tax shows as an empty tax box, as on the edit form", () => {
    expect(duplicateFormValues({ ...SOURCE, tax_percent: 0 }, new Set()).tax_percent).toBe("");
  });
});
