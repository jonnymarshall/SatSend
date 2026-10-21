import { describe, it, expect } from "vitest";
import { buildPdfFilename } from "./pdf-filename";

describe("buildPdfFilename", () => {
  it("uses your_company as the sender when set", () => {
    expect(
      buildPdfFilename({
        id: "11111111-2222-3333-4444-555555555555",
        invoice_number: "INV-001",
        your_company: "Acme Co",
        your_name: "Alice",
        your_email: "alice@acme.com",
        created_at: "2026-04-20T10:00:00Z",
      })
    ).toBe("Acme_Co_INV-001_20260420.pdf");
  });

  it("falls back to your_name when your_company is missing", () => {
    expect(
      buildPdfFilename({
        id: "11111111-2222-3333-4444-555555555555",
        invoice_number: "INV-002",
        your_company: null,
        your_name: "Alice Smith",
        your_email: "alice@acme.com",
        created_at: "2026-04-20T10:00:00Z",
      })
    ).toBe("Alice_Smith_INV-002_20260420.pdf");
  });

  it("falls back to email prefix when company and name are missing", () => {
    expect(
      buildPdfFilename({
        id: "11111111-2222-3333-4444-555555555555",
        invoice_number: "INV-003",
        your_company: null,
        your_name: null,
        your_email: "alice.smith@acme.com",
        created_at: "2026-04-20T10:00:00Z",
      })
    ).toBe("alice.smith_INV-003_20260420.pdf");
  });

  it("falls back to the account_email prefix when invoice sender fields are all blank", () => {
    expect(
      buildPdfFilename({
        id: "11111111-2222-3333-4444-555555555555",
        invoice_number: "INV-004",
        your_company: null,
        your_name: null,
        your_email: null,
        created_at: "2026-04-20T10:00:00Z",
        account_email: "jonnymarshall5@example.com",
      })
    ).toBe("jonnymarshall5_INV-004_20260420.pdf");
  });

  it('uses literal "invoice" only when every email/name/company source is missing', () => {
    expect(
      buildPdfFilename({
        id: "11111111-2222-3333-4444-555555555555",
        invoice_number: "INV-004b",
        your_company: null,
        your_name: null,
        your_email: null,
        created_at: "2026-04-20T10:00:00Z",
      })
    ).toBe("invoice_INV-004b_20260420.pdf");
  });

  it("treats blank-string sender fields as missing", () => {
    expect(
      buildPdfFilename({
        id: "11111111-2222-3333-4444-555555555555",
        invoice_number: "INV-005",
        your_company: "   ",
        your_name: "",
        your_email: "alice@acme.com",
        created_at: "2026-04-20T10:00:00Z",
      })
    ).toBe("alice_INV-005_20260420.pdf");
  });

  it("falls back to the short id when invoice_number is missing", () => {
    expect(
      buildPdfFilename({
        id: "11111111-2222-3333-4444-555512345678",
        invoice_number: null,
        your_company: "Acme",
        your_name: null,
        your_email: null,
        created_at: "2026-04-20T10:00:00Z",
      })
    ).toBe("Acme_…12345678_20260420.pdf");
  });

  it("sanitises slashes, backslashes and whitespace in sender and invoice name", () => {
    expect(
      buildPdfFilename({
        id: "11111111-2222-3333-4444-555555555555",
        invoice_number: "  INV / 006 \\ x  ",
        your_company: " Acme / Co \\ Ltd  ",
        your_name: null,
        your_email: null,
        created_at: "2026-04-20T10:00:00Z",
      })
    ).toBe("Acme_Co_Ltd_INV_006_x_20260420.pdf");
  });

  it("formats the date as UTC YYYYMMDD even when the local timezone would shift it", () => {
    expect(
      buildPdfFilename({
        id: "11111111-2222-3333-4444-555555555555",
        invoice_number: "INV-007",
        your_company: "Acme",
        your_name: null,
        your_email: null,
        created_at: "2026-04-20T23:30:00Z",
      })
    ).toBe("Acme_INV-007_20260420.pdf");
  });

  it("prefers published_at over created_at when both are provided", () => {
    expect(
      buildPdfFilename({
        id: "11111111-2222-3333-4444-555555555555",
        invoice_number: "INV-008",
        your_company: "Acme",
        your_name: null,
        your_email: null,
        created_at: "2026-04-20T10:00:00Z",
        published_at: "2026-05-01T10:00:00Z",
      })
    ).toBe("Acme_INV-008_20260501.pdf");
  });

  it("uses the sent date first: it's the invoice date (v1.5.19)", () => {
    expect(
      buildPdfFilename({
        id: "11111111-2222-3333-4444-555555555555",
        invoice_number: "INV-009",
        your_company: "Acme",
        your_name: null,
        your_email: null,
        created_at: "2026-04-20T10:00:00Z",
        // published_at can be reset to restart payment checks; never shown.
        published_at: "2026-06-30T10:00:00Z",
        sent_at: "2026-05-02T10:00:00Z",
      })
    ).toBe("Acme_INV-009_20260502.pdf");
  });
});
