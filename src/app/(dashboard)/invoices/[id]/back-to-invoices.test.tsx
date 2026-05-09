import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BackToInvoices } from "./back-to-invoices";

const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // reset history length state on the global object
  Object.defineProperty(window, "history", {
    value: { length: 1 },
    writable: true,
    configurable: true,
  });
});

describe("BackToInvoices", () => {
  it("calls router.back() when there is browser history", () => {
    Object.defineProperty(window, "history", {
      value: { length: 5 },
      writable: true,
      configurable: true,
    });
    render(<BackToInvoices />);
    fireEvent.click(screen.getByRole("button", { name: /← invoices/i }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("falls back to /invoices when history is empty (deep-link case)", () => {
    Object.defineProperty(window, "history", {
      value: { length: 1 },
      writable: true,
      configurable: true,
    });
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
