import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { FAQ_GROUPS, HOMEPAGE_FAQ, PRICING_FAQ, faqById } from "./faq-content";

// v1.5.22: every question lives once; the homepage, /pricing and /faq read it.
describe("faq content", () => {
  it("each question has one id and one wording", () => {
    const ids = FAQ_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the homepage shows the agreed eight, in its order, all from the FAQ", () => {
    expect(HOMEPAGE_FAQ.map((i) => i.q)).toEqual([
      "Is SatSend really non-custodial?",
      "Are there any fees?",
      "Does my client need a SatSend account?",
      "How is the bitcoin amount worked out?",
      "How do I know when I've been paid?",
      "What if my client pays the wrong amount?",
      "Why do I need a new bitcoin address for each invoice?",
      "Is there a limit on invoices?",
    ]);
    for (const item of HOMEPAGE_FAQ) expect(faqById(item.id)).toBe(item);
  });

  it("the Pricing page's five are the FAQ's own pricing answers", () => {
    expect(PRICING_FAQ).toHaveLength(5);
    const pricing = FAQ_GROUPS.find((g) => g.id === "pricing")!.items;
    for (const item of PRICING_FAQ) expect(pricing).toContain(item);
  });

  it("is grouped as agreed, and doesn't claim to be open source yet", () => {
    expect(FAQ_GROUPS.map((g) => g.title)).toEqual([
      "Getting started",
      "Getting paid",
      "Invoices",
      "Security and privacy",
      "Pricing",
    ]);
    const all = FAQ_GROUPS.flatMap((g) => g.items.map((i) => i.q)).join(" ");
    expect(all).not.toMatch(/open source/i);
    expect(all).toMatch(/delete my account/i);
  });

  it("explains the code is source available under the FSL, with a link (v1.5.23)", () => {
    const security = FAQ_GROUPS.find((g) => g.id === "security")!;
    const code = security.items.find((i) => i.id === "source-code")!;
    expect(code.q).toBe("Can I see SatSend's code?");
    const { container } = render(<>{code.a}</>);
    expect(container).toHaveTextContent(/source available/i);
    expect(container).toHaveTextContent(/Functional Source License/);
    expect(container).toHaveTextContent(/except offering a competing product/i);
    expect(container).toHaveTextContent(/two years after each version is released/i);
    expect(container.querySelector('a[href="https://fsl.software"]')).not.toBeNull();
  });
});
