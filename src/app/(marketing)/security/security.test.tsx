import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import SecurityPage, { metadata } from "./page";
import { PLACEHOLDER_PAGES, SOCIAL_LINKS } from "@/lib/site-links";

describe("Security page (v1.5.25)", () => {
  it("is a real page that search engines can index", () => {
    render(<SecurityPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(PLACEHOLDER_PAGES.map((p) => p.path)).not.toContain("/security");
    expect(String(metadata.title)).toMatch(/Security/);
    expect(String(metadata.title)).toContain("SatSend");
    expect(metadata.robots).toBeUndefined();
  });

  it("has the agreed sections", () => {
    render(<SecurityPage />);
    for (const name of [
      /never touches satsend/i,
      /what we store/i,
      /your receiving address/i,
      /access codes/i,
      /audit the code/i,
      /found a problem/i,
    ]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });

  it("calls the code source available, never open source", () => {
    const { container } = render(<SecurityPage />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/source available/i);
    // The only allowed mention describes Apache 2.0, the future licence, not SatSend.
    expect(text.replace("Apache 2.0 licence, an open-source licence", "")).not.toMatch(/open[- ]source/i);
    expect(screen.getByRole("link", { name: /learn more about the fsl/i })).toHaveAttribute("href", "https://fsl.software");
  });

  it("uses the FAQ's licence wording, without the FAQ's \"Yes.\"", () => {
    render(<SecurityPage />);
    const audit = screen.getByRole("region", { name: /audit the code/i });
    expect(audit.textContent).toMatch(/SatSend is source available/);
    expect(audit.textContent).not.toMatch(/Yes\./);
  });

  it("never explains networks to the user", () => {
    const { container } = render(<SecurityPage />);
    expect(container.textContent).not.toMatch(/testnet|network it/i);
  });

  it("points to the code and to reporting a problem", () => {
    render(<SecurityPage />);
    const audit = screen.getByRole("region", { name: /audit the code/i });
    expect(within(audit).getByRole("link", { name: /view the code/i })).toHaveAttribute("href", SOCIAL_LINKS.github);
    const report = screen.getByRole("region", { name: /found a problem/i });
    expect(within(report).getByRole("link", { name: /contact us/i })).toHaveAttribute("href", "/contact");
    expect(within(report).getByRole("link", { name: /open an issue/i })).toHaveAttribute("href", SOCIAL_LINKS.github);
  });
});
