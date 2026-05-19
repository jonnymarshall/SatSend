import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BackToInvoices } from "./back-to-invoices";

const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

function setReferrer(value: string) {
  Object.defineProperty(document, "referrer", {
    value,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setReferrer("");
});

describe("BackToInvoices", () => {
  it("calls router.back() when the referrer is same-origin (user clicked from our app)", () => {
    setReferrer(`${window.location.origin}/invoices?page=2`);
    render(<BackToInvoices />);
    fireEvent.click(screen.getByRole("button", { name: /← invoices/i }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("falls back to /invoices when document.referrer is empty (deep-link case: paste URL)", () => {
    setReferrer("");
    render(<BackToInvoices />);
    fireEvent.click(screen.getByRole("button", { name: /← invoices/i }));
    expect(mockPush).toHaveBeenCalledWith("/invoices");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("falls back to /invoices when referrer is from a different origin (deep-link: email click)", () => {
    setReferrer("https://mail.google.com/inbox");
    render(<BackToInvoices />);
    fireEvent.click(screen.getByRole("button", { name: /← invoices/i }));
    expect(mockPush).toHaveBeenCalledWith("/invoices");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("falls back to /invoices when referrer is malformed", () => {
    setReferrer("not a url");
    render(<BackToInvoices />);
    fireEvent.click(screen.getByRole("button", { name: /← invoices/i }));
    expect(mockPush).toHaveBeenCalledWith("/invoices");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("renders with the existing id for the back link", () => {
    render(<BackToInvoices />);
    expect(document.getElementById("invoice-detail--back-link")).not.toBeNull();
  });
});
