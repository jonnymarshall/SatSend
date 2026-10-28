import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import PaymentSettlementPage, { metadata } from "./page";
import { FOOTER_COLUMNS } from "@/lib/site-links";
import { slippageToleranceFiat } from "@/lib/invoices/payment-schedule";
import { QUOTE_VALID_MS } from "@/lib/invoices/quotes";

// v1.5.29 (roadmap v1.5.2.22-H): one page that explains, for the person sending
// an invoice and for the client paying it, how a payment is judged.

describe("How payments are settled page (v1.5.29)", () => {
  it("is a real page that search engines can index", () => {
    render(<PaymentSettlementPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(String(metadata.title)).toMatch(/How payments are settled/);
    expect(String(metadata.title)).toContain("SatSend");
    expect(metadata.robots).toBeUndefined();
  });

  it("is linked from the footer", () => {
    const product = FOOTER_COLUMNS.find((c) => c.heading === "Product")!;
    expect(product.links).toContainEqual({ label: "Payment settlement", href: "/payment-settlement" });
  });

  it("has the agreed sections, each reachable from a topic button", () => {
    const { container } = render(<PaymentSettlementPage />);
    for (const name of [
      /in short/i,
      /held for 30 minutes/i,
      /slippage tolerance/i,
      /settlement variance/i,
      /underpaid or overpaid/i,
      /without a held amount/i,
      /when a payment counts as paid/i,
    ]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    const links = within(screen.getByRole("navigation", { name: /jump to/i })).getAllByRole("link");
    expect(links).toHaveLength(7);
    for (const link of links) {
      expect(container.querySelector(link.getAttribute("href")!)?.tagName).toBe("SECTION");
    }
  });

  it("speaks to both the client and the sender", () => {
    render(<PaymentSettlementPage />);
    expect(screen.getByRole("heading", { name: /if you're paying an invoice/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /if you sent the invoice/i })).toBeInTheDocument();
  });

  it("states the real numbers: 30 minutes, 1% up to $25, with examples that match the code", () => {
    const { container } = render(<PaymentSettlementPage />);
    const text = container.textContent!;
    expect(QUOTE_VALID_MS).toBe(30 * 60_000);
    expect(text).toContain("1% of the invoice total, up to $25");
    for (const [total, tolerance] of [
      ["$100", "$1.00"],
      ["$1,000", "$10.00"],
      ["$8,000", "$25.00"],
    ]) {
      const row = screen.getByRole("row", { name: new RegExp(`^${total.replace("$", "\\$")}\\b`) });
      expect(row.textContent).toContain(tolerance);
    }
    expect(slippageToleranceFiat(100)).toBe(1);
    expect(slippageToleranceFiat(1_000)).toBe(10);
    expect(slippageToleranceFiat(8_000)).toBe(25);
  });

  it("never says SatSend received or holds the payment", () => {
    const { container } = render(<PaymentSettlementPage />);
    expect(container.textContent).not.toMatch(/\bwe received\b|\breceived by satsend\b/i);
    expect(container.textContent).toMatch(/never holds/i);
  });

  it("never mentions the old 5% or the old name", () => {
    const { container } = render(<PaymentSettlementPage />);
    expect(container.textContent).not.toMatch(/5%|exchange rate variance|allowance/i);
  });
});
