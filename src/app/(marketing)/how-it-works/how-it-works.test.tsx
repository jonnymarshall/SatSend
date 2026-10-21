import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import HowItWorksPage, { metadata } from "./page";
import { PLACEHOLDER_PAGES } from "@/lib/site-links";

describe("How it works page (v1.5.18)", () => {
  it("is a real page, not a placeholder", () => {
    render(<HowItWorksPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("From invoice to bitcoin in your wallet");
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    expect(PLACEHOLDER_PAGES.map((p) => p.path)).not.toContain("/how-it-works");
  });

  it("walks through the four agreed steps, each with a real screenshot", () => {
    render(<HowItWorksPage />);
    const steps = screen.getByRole("list", { name: "Steps" });
    const items = Array.from(steps.querySelectorAll<HTMLElement>(":scope > li"));
    expect(items.map((li) => within(li).getByRole("heading", { level: 2 }).textContent)).toEqual([
      "Create your invoice",
      "Send it",
      "Your client pays",
      "You're told",
    ]);
    for (const li of items) {
      const img = within(li).getByRole("img");
      expect(img).toHaveAttribute("alt");
      const src = decodeURIComponent(img.getAttribute("src") ?? "");
      const file = src.match(/\/marketing\/how-it-works\/[a-z-]+\.png/)?.[0];
      expect(file, src).toBeTruthy();
      expect(existsSync(path.join(process.cwd(), "public", file!))).toBe(true);
    }
  });

  it("has the client panel, what you need, and the closing band", () => {
    render(<HowItWorksPage />);
    expect(screen.getByRole("region", { name: "What your client sees" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "What you'll need" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/signup");
  });

  it("is titled for SatSend and can be found by search engines", () => {
    expect(String(metadata.title)).toContain("How it works");
    expect(String(metadata.title)).toContain("SatSend");
    expect(metadata.robots).toBeUndefined();
  });
});
