import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PricingPlans } from "./pricing-plans";

// v1.5.21: the Free and Pro cards, shared by the homepage and /pricing, with a
// Monthly / Yearly (2 months free) toggle. R-65: $15 / $150, 10% off in bitcoin.
describe("PricingPlans", () => {
  it("starts on Monthly: Free $0, Pro $15 a month, marked coming soon", () => {
    render(<PricingPlans idPrefix="t" />);
    expect(screen.getByRole("radio", { name: /monthly/i })).toHaveAttribute("aria-checked", "true");
    const free = screen.getByRole("article", { name: "Free" });
    const pro = screen.getByRole("article", { name: "Pro" });
    expect(free).toHaveTextContent("$0");
    expect(pro).toHaveTextContent("$15");
    expect(pro).toHaveTextContent("Coming soon");
    expect(pro).not.toHaveTextContent(/billed/i);
  });

  it("Monthly shows the bitcoin price: $13.50 a month, 10% off", () => {
    render(<PricingPlans idPrefix="t" />);
    const note = document.getElementById("t--pro--price-note");
    expect(note).toHaveTextContent("$13.50 a month in bitcoin (10% off)");
  });

  it("Yearly flips Pro to $12.50 a month, billed $150 yearly or $135 in bitcoin; Free stays $0", () => {
    render(<PricingPlans idPrefix="t" />);
    const yearly = screen.getByRole("radio", { name: /yearly/i });
    expect(yearly).toHaveTextContent(/2 months free/i);
    fireEvent.click(yearly);
    expect(yearly).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /monthly/i })).toHaveAttribute("aria-checked", "false");
    const pro = screen.getByRole("article", { name: "Pro" });
    expect(pro).toHaveTextContent("$12.50");
    expect(document.getElementById("t--pro--price-note")).toHaveTextContent("Billed $150 yearly, or $135 in bitcoin");
    expect(screen.getByRole("article", { name: "Free" })).toHaveTextContent("$0");
  });

  it("the toggle is one labelled group of two choices", () => {
    render(<PricingPlans idPrefix="t" />);
    const group = screen.getByRole("radiogroup", { name: /billing period/i });
    expect(within(group).getAllByRole("radio")).toHaveLength(2);
  });

  it("Free lists 'Payment confirmation emails', the same name as the comparison table", () => {
    render(<PricingPlans idPrefix="t" />);
    expect(screen.getByRole("article", { name: "Free" })).toHaveTextContent("Payment confirmation emails");
    expect(screen.queryByText(/you've been paid/i)).not.toBeInTheDocument();
  });

  it("says Pro can be paid by card, or in bitcoin for 10% off", () => {
    render(<PricingPlans idPrefix="t" />);
    expect(document.getElementById("t--pro-note")).toHaveTextContent("Pay for Pro by card, or in bitcoin for 10% off.");
  });
});
