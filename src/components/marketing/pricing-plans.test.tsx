import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PricingPlans, PRO_PRICE } from "./pricing-plans";

// v1.5.21: the Free and Pro cards, shared by the homepage and /pricing, with a
// Monthly / Yearly (2 months free) toggle.
describe("PricingPlans", () => {
  it("is $10 a month for Pro by default, and $100 a year (2 months free)", () => {
    expect(PRO_PRICE).toEqual({ monthly: 10, yearly: 100 });
  });

  it("starts on Monthly: Free $0, Pro $10 a month, marked coming soon", () => {
    render(<PricingPlans idPrefix="t" />);
    expect(screen.getByRole("radio", { name: /monthly/i })).toHaveAttribute("aria-checked", "true");
    const free = screen.getByRole("article", { name: "Free" });
    const pro = screen.getByRole("article", { name: "Pro" });
    expect(free).toHaveTextContent("$0");
    expect(pro).toHaveTextContent("$10");
    expect(pro).toHaveTextContent("Coming soon");
    expect(pro).not.toHaveTextContent(/billed/i);
  });

  it("Yearly flips Pro to $8.33 a month, billed $100 yearly; Free stays $0", () => {
    render(<PricingPlans idPrefix="t" />);
    const yearly = screen.getByRole("radio", { name: /yearly/i });
    expect(yearly).toHaveTextContent(/2 months free/i);
    fireEvent.click(yearly);
    expect(yearly).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /monthly/i })).toHaveAttribute("aria-checked", "false");
    const pro = screen.getByRole("article", { name: "Pro" });
    expect(pro).toHaveTextContent("$8.33");
    expect(pro).toHaveTextContent(/billed \$100 yearly/i);
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

  it("says Pro can be paid in bitcoin or by card", () => {
    render(<PricingPlans idPrefix="t" />);
    expect(screen.getByText(/bitcoin or by card/i)).toBeInTheDocument();
  });
});
