import { describe, it, expect } from "vitest";
import { PDFParse } from "pdf-parse";
import type { Invoice } from "@/lib/invoice-public";
import { renderInvoicePdf } from "./invoice-pdf";

const baseInvoice: Invoice = {
  id: "inv-id-1",
  user_id: "user-1",
  invoice_number: "INV-2026-001",
  your_name: "Ada Lovelace",
  your_email: "ada@example.com",
  your_company: "Analytical Ltd",
  your_address: "1 Tower Bridge, London",
  your_tax_id: "GB123456789",
  client_name: "Charles Babbage",
  client_email: "charles@example.com",
  client_company: "Difference Engine Co",
  client_address: "10 Bloomsbury, London",
  client_tax_id: "GB987654321",
  line_items: [
    { description: "Analytical engine design", quantity: 10, unit_price: 500 },
    { description: "Consulting hours", quantity: 4, unit_price: 250 },
  ],
  subtotal_fiat: 6000,
  tax_fiat: 1200,
  tax_percent: 20,
  total_fiat: 7200,
  currency: "USD",
  btc_address: "bc1qexampleaddressforinvoice000000000000",
  btc_txid: null,
  status: "pending",
  access_code: null,
  due_date: "2026-05-15",
  created_at: "2026-04-15T10:00:00Z",
  updated_at: "2026-04-15T10:00:00Z",
};

async function textFromPdf(invoice: Invoice, appUrl = "https://paybitty.test"): Promise<string> {
  const buf = await renderInvoicePdf(invoice, { appUrl });
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

describe("renderInvoicePdf", () => {
  it("includes the invoice number", async () => {
    const text = await textFromPdf({ ...baseInvoice, invoice_number: "INV-2026-042" });
    expect(text).toContain("INV-2026-042");
  });

  it("includes the subtotal, tax, and total formatted as currency", async () => {
    const text = await textFromPdf(baseInvoice);
    expect(text).toContain("$6,000.00");
    expect(text).toContain("$1,200.00");
    expect(text).toContain("$7,200.00");
  });

  it("includes sender and client names", async () => {
    const text = await textFromPdf(baseInvoice);
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("Charles Babbage");
  });

  it("includes every line item description", async () => {
    const text = await textFromPdf(baseInvoice);
    expect(text).toContain("Analytical engine design");
    expect(text).toContain("Consulting hours");
  });

  it("includes the BTC address when btc_address is set", async () => {
    const text = await textFromPdf(baseInvoice);
    expect(text).toContain("bc1qexampleaddressforinvoice000000000000");
  });

  it("omits BTC address when btc_address is null (drafts)", async () => {
    const text = await textFromPdf({ ...baseInvoice, btc_address: null });
    expect(text).not.toContain("bc1qexampleaddressforinvoice000000000000");
  });

  it("includes a 'Date Due' label and the formatted due date", async () => {
    const text = await textFromPdf(baseInvoice);
    expect(text).toContain("Date Due");
    expect(text).toContain("May 15, 2026");
  });

  it("shows 'No due date' when the invoice has no due_date", async () => {
    const text = await textFromPdf({ ...baseInvoice, due_date: null });
    expect(text).toContain("Date Due");
    expect(text).toContain("No due date");
  });

  it("includes a 'Date Created' label and the formatted creation date", async () => {
    const text = await textFromPdf(baseInvoice);
    expect(text).toContain("Date Created");
    expect(text).toContain("April 15, 2026");
  });

  it("includes the public invoice URL built from the supplied appUrl, labelled 'View and pay online'", async () => {
    const text = await textFromPdf(baseInvoice, "https://paybitty.app");
    expect(text).toContain("View and pay online");
    expect(text).toContain("https://paybitty.app/invoice/inv-id-1");
  });

  it("explains that the QR code does not encode an amount and points the payer to the public link", async () => {
    const text = await textFromPdf(baseInvoice);
    expect(text).toContain("does not encode the amount");
    expect(text).toContain("View and pay online");
  });

  it("does not link to any third-party spot-price API from the BTC block", async () => {
    const text = await textFromPdf(baseInvoice);
    expect(text).not.toContain("api.coinbase.com");
    expect(text).not.toContain("api.coingecko.com");
  });
});
