import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("./actions", () => ({
  markInvoicePaidByPayer: vi.fn(),
}));

import { markInvoicePaidByPayer } from "./actions";
import { PayFiatButton } from "./pay-fiat-button";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PayFiatButton", () => {
  it("renders the trigger with the currency label", () => {
    render(<PayFiatButton invoiceId="inv-1" currency="USD" onMarked={() => {}} />);
    expect(screen.getByRole("button", { name: /pay with usd/i })).toBeInTheDocument();
  });

  it("opens a confirmation dialog with the prescribed payer copy", () => {
    render(<PayFiatButton invoiceId="inv-1" currency="USD" onMarked={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /pay with usd/i }));
    // The exact copy from the roadmap — matters because the user explicitly
    // approved this wording. Test it verbatim so it can't be silently edited.
    expect(
      screen.getByText(
        /by clicking confirm, you are marking this invoice as paid\. to avoid any confusion with the payee, please do not click confirm until after you have made payment/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeInTheDocument();
  });

  it("calls markInvoicePaidByPayer with the invoice id when Confirm is clicked, then invokes onMarked", async () => {
    vi.mocked(markInvoicePaidByPayer).mockResolvedValue({ ok: true });
    const onMarked = vi.fn();
    render(<PayFiatButton invoiceId="inv-77" currency="USD" onMarked={onMarked} />);
    fireEvent.click(screen.getByRole("button", { name: /pay with usd/i }));
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => {
      expect(markInvoicePaidByPayer).toHaveBeenCalledWith("inv-77");
      expect(onMarked).toHaveBeenCalledTimes(1);
    });
  });

  it("surfaces a server-side rejection inline (does not invoke onMarked)", async () => {
    vi.mocked(markInvoicePaidByPayer).mockResolvedValue({
      ok: false,
      reason: "Invoice is not in a payable state",
    });
    const onMarked = vi.fn();
    render(<PayFiatButton invoiceId="inv-1" currency="USD" onMarked={onMarked} />);
    fireEvent.click(screen.getByRole("button", { name: /pay with usd/i }));
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/not in a payable state/i);
      expect(onMarked).not.toHaveBeenCalled();
    });
  });
});
