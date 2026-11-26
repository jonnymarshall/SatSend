import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BackToInvoices } from "./back-to-invoices";
import { rememberInvoiceListUrl } from "@/lib/invoices/list-return";

const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

function setReferrer(value: string) {
  Object.defineProperty(document, "referrer", { value, writable: true, configurable: true });
}

function clickBack() {
  render(<BackToInvoices />);
  fireEvent.click(screen.getByRole("button", { name: /← invoices/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  setReferrer("");
});

// R-63: "back" used to be the browser's back, which after saving a draft is the
// edit page. It now always opens the invoice list.
describe("BackToInvoices", () => {
  it("after saving a draft (the page before was the edit form), opens the list, not the edit form", () => {
    setReferrer(`${window.location.origin}/invoices/abc/edit`);
    clickBack();
    expect(mockPush).toHaveBeenCalledWith("/invoices");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("returns to the page of the list you were on", () => {
    rememberInvoiceListUrl("/invoices?page=2");
    setReferrer(`${window.location.origin}/invoices?page=2`);
    clickBack();
    expect(mockPush).toHaveBeenCalledWith("/invoices?page=2");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("opened from an email or a pasted link, opens the list", () => {
    setReferrer("https://mail.google.com/inbox");
    clickBack();
    expect(mockPush).toHaveBeenCalledWith("/invoices");
  });

  it("renders with the existing id for the back link", () => {
    render(<BackToInvoices />);
    expect(document.getElementById("invoice-detail--back-link")).not.toBeNull();
  });
});
