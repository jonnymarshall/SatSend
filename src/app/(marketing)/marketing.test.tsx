import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import HomePage, { metadata } from "./page";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PREVIEW_QR_VALUE } from "@/components/marketing/product-preview";
import { FOOTER_COLUMNS, NAV_LINKS, PLACEHOLDER_PAGES, SOCIAL_LINKS } from "@/lib/site-links";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));

const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => redirect(...a) }));

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: null } });
});

describe("homepage (v1.5.16)", () => {
  it("renders for everyone with the hero, both buttons and no redirect", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Invoice in bitcoin.Paid straight to your wallet.",
    );
    const hero = screen.getByRole("region", { name: /invoice in bitcoin/i });
    expect(within(hero).getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/signup");
    expect(within(hero).getByRole("link", { name: "How it works" })).toHaveAttribute("href", "#how-it-works");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("has every agreed section", () => {
    const { container } = render(<HomePage />);
    for (const id of ["hero", "trust", "how-it-works", "highlights", "pricing", "faq", "cta"]) {
      expect(container.querySelector(`#${id === "how-it-works" ? id : `home--${id}`}`)).not.toBeNull();
    }
    expect(screen.getByText("Fully open source")).toBeInTheDocument();
    expect(screen.getByText("Non-custodial by design")).toBeInTheDocument();
  });

  it("shows Free at $0 and Pro at $10, Pro marked coming soon", () => {
    render(<HomePage />);
    const free = screen.getByRole("article", { name: "Free" });
    const pro = screen.getByRole("article", { name: "Pro" });
    expect(free).toHaveTextContent("$0");
    expect(free).toHaveTextContent("Invoices emailed to your client");
    expect(free).toHaveTextContent("1 saved client");
    expect(pro).toHaveTextContent("$10");
    expect(pro).toHaveTextContent("Coming soon");
    expect(pro).toHaveTextContent("Automatic payment reminders");
  });

  it("answers the eight agreed questions", () => {
    render(<HomePage />);
    const faq = screen.getByRole("region", { name: /questions/i });
    expect(within(faq).getAllByRole("group")).toHaveLength(8);
    expect(faq).toHaveTextContent("What if my client pays the wrong amount?");
    expect(faq).toHaveTextContent("Is there a limit on invoices?");
  });

  it("the hero's example QR code can't be paid", () => {
    expect(PREVIEW_QR_VALUE.toLowerCase()).not.toMatch(/^bitcoin:/);
  });

  it("metadata names SatSend in the title and the link preview", () => {
    expect(String(metadata.title)).toContain("SatSend");
    expect(String(metadata.openGraph?.title)).toContain("SatSend");
    expect(metadata.description).toBeTruthy();
    expect(JSON.stringify(metadata.openGraph?.images)).toContain("/opengraph-image");
  });
});

describe("site header (v1.5.16)", () => {
  it("signed out: Log in and Get started", async () => {
    render(await SiteHeader());
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/signup");
    expect(screen.queryByRole("link", { name: "Go to app" })).not.toBeInTheDocument();
  });

  it("signed in: Go to app instead, and no redirect", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "ada@example.com" } } });
    render(await SiteHeader());
    expect(screen.getByRole("link", { name: "Go to app" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("the logo goes home", async () => {
    render(await SiteHeader());
    expect(screen.getByRole("link", { name: /go to homepage/i })).toHaveAttribute("href", "/");
  });
});

describe("site footer (v1.5.16)", () => {
  it("has the agreed columns, social links, and no Log in", () => {
    render(<SiteFooter />);
    for (const heading of ["Product", "Company", "Developers", "Legal"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "SatSend on X" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SatSend on LinkedIn" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
    expect(screen.getByText(/© 2026 SatSend/)).toBeInTheDocument();
  });
});

describe("no dead links (v1.5.16)", () => {
  const appDir = path.resolve(__dirname, "..");
  const hasPage = (href: string) =>
    ["(marketing)", "(auth)", "(dashboard)", ""].some((group) =>
      existsSync(path.join(appDir, group, href, "page.tsx")),
    );

  const internal = [
    ...NAV_LINKS.map((l) => l.href),
    ...FOOTER_COLUMNS.flatMap((c) => c.links.map((l) => l.href)),
    ...Object.values(SOCIAL_LINKS),
    "/login",
    "/signup",
    "/dashboard",
  ].filter((href) => href.startsWith("/"));

  it.each(internal)("%s has a page", (href) => {
    expect(hasPage(href)).toBe(true);
  });

  it("every placeholder page is listed once", () => {
    const paths = PLACEHOLDER_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of PLACEHOLDER_PAGES) expect(hasPage(p.path)).toBe(true);
  });
});
