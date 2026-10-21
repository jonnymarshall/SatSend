import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import PricingPage, { metadata } from "./page";
import { PLACEHOLDER_PAGES } from "@/lib/site-links";

describe("Pricing page (v1.5.21)", () => {
  it("is a real page that search engines can index", () => {
    render(<PricingPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("Coming soon", { selector: "p" })).not.toBeInTheDocument();
    expect(PLACEHOLDER_PAGES.map((p) => p.path)).not.toContain("/pricing");
    expect(String(metadata.title)).toMatch(/pricing/i);
    expect(String(metadata.title)).toContain("SatSend");
    expect(metadata.robots).toBeUndefined();
  });

  it("shows the plan cards with the Monthly / Yearly toggle", () => {
    render(<PricingPage />);
    expect(screen.getByRole("article", { name: "Free" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Pro" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /billing period/i })).toBeInTheDocument();
  });

  it("compares every feature, Free against Pro", () => {
    render(<PricingPage />);
    const table = screen.getByRole("table", { name: /compare plans/i });
    const header = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(header).toEqual(["Feature", "Free", "Pro"]);
    const row = (name: RegExp) => within(table).getByRole("row", { name });
    expect(row(/saved clients/i)).toHaveTextContent(/1.*unlimited/i);
    expect(row(/payment reminders/i)).toHaveTextContent(/not included/i);
    expect(row(/unlimited invoices/i)).not.toHaveTextContent(/not included/i);
  });

  it("orders the rows: both plans, fees, saved clients, then the Free-cross / Pro-tick rows (v1.5.21)", () => {
    render(<PricingPage />);
    const table = screen.getByRole("table", { name: /compare plans/i });
    const features = within(table).getAllByRole("rowheader").map((h) => h.textContent);
    expect(features).toEqual([
      "Unlimited invoices",
      "Automatic payment detection",
      "Invoice link and PDF",
      "Invoices emailed to your client",
      "Payment confirmation emails",
      "Non-custodial: paid straight to your wallet",
      "Transaction fees",
      "Saved clients",
      "Emails sent in your name",
      "Reusable line items",
      "Your own link: satsend.me/yourname",
      "Client pages: all of a client's invoices in one place",
      "Your logo and colours on invoices, PDFs and emails",
      "Automatic payment reminders",
    ]);
  });

  it("uses a cross, not a dash, for what Free doesn't include; cells are short", () => {
    const { container } = render(<PricingPage />);
    const table = container.querySelector("#pricing--compare--table")!;
    expect(table.querySelectorAll(".lucide-minus")).toHaveLength(0);
    expect(table.querySelectorAll(".lucide-x").length).toBeGreaterThan(0);
    expect(table).not.toHaveTextContent(/replies to you|sent from/i);
    const emails = within(table as HTMLElement).getByRole("row", { name: /emails sent in your name/i });
    expect(emails).toHaveTextContent(/not included/i);
  });

  it("answers the five pricing questions as agreed", () => {
    render(<PricingPage />);
    const faq = screen.getByRole("region", { name: /pricing questions/i });
    expect(within(faq).getAllByRole("group")).toHaveLength(5);
    expect(faq).toHaveTextContent(/bitcoin.*credit or debit card/i);
    expect(faq).toHaveTextContent(/by card.*renews.*turn it off.*at any time/i);
    expect(faq).toHaveTextContent(/bitcoin.*doesn't renew/i);
    expect(faq).toHaveTextContent(/all your invoices/i);
    expect(faq).toHaveTextContent(/within 15 days/i);
    expect(within(faq).getByRole("link", { name: /contact support/i })).toHaveAttribute("href", "/contact");
    expect(faq).toHaveTextContent(/free forever/i);
  });
});
