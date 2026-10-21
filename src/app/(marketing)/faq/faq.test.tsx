import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import FaqPage, { metadata } from "./page";
import { FAQ_GROUPS } from "@/components/marketing/faq-content";
import { PLACEHOLDER_PAGES } from "@/lib/site-links";

describe("FAQ page (v1.5.22)", () => {
  it("is a real page that search engines can index", () => {
    render(<FaqPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(PLACEHOLDER_PAGES.map((p) => p.path)).not.toContain("/faq");
    expect(String(metadata.title)).toMatch(/FAQ/);
    expect(String(metadata.title)).toContain("SatSend");
    expect(metadata.robots).toBeUndefined();
  });

  it("has jump links to every group, and each group holds its questions", () => {
    render(<FaqPage />);
    const jump = screen.getByRole("navigation", { name: /jump to/i });
    for (const group of FAQ_GROUPS) {
      expect(within(jump).getByRole("link", { name: group.title })).toHaveAttribute("href", `#faq--${group.id}`);
      const section = screen.getByRole("region", { name: group.title });
      expect(section).toHaveAttribute("id", `faq--${group.id}`);
      expect(within(section).getAllByRole("group")).toHaveLength(group.items.length);
    }
  });

  it("answers account deletion and points to support", () => {
    render(<FaqPage />);
    const q = screen.getByText(/can i delete my account/i).closest("details")!;
    expect(within(q).getByRole("link", { name: /contact support/i })).toHaveAttribute("href", "/contact");
  });

  it("ends with a way to ask something else", () => {
    render(<FaqPage />);
    expect(screen.getByRole("link", { name: /contact us/i })).toHaveAttribute("href", "/contact");
  });
});
