import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { InvoicePaymentView } from "./invoice-payment-view";
import type { Invoice } from "@/lib/invoice-public";

vi.mock("@/lib/btc-network", () => ({
  getMempoolBaseUrl: () => "https://mempool.space",
  getMempoolWsUrl: () => "wss://mempool.space/testnet4/api/v1/ws",
}));

// Capture the callbacks and props the view wires up so tests can drive realtime / watcher events.
let capturedWatcherOnStatusChange:
  | ((s: Invoice["status"], txid?: string) => void)
  | null = null;
let capturedWatcherPaymentRevealed: boolean | undefined = undefined;
let capturedRealtimeOnUpdate:
  | ((next: Partial<Invoice> & { id: string }) => void)
  | null = null;

vi.mock("./payment-watcher", () => ({
  PaymentWatcher: (props: {
    onStatusChange: (s: Invoice["status"], txid?: string) => void;
    paymentRevealed?: boolean;
  }) => {
    capturedWatcherOnStatusChange = props.onStatusChange;
    capturedWatcherPaymentRevealed = props.paymentRevealed;
    return null;
  },
}));
vi.mock("./use-public-invoice-realtime", () => ({
  usePublicInvoiceRealtime: (
    _id: string,
    onUpdate: (next: Partial<Invoice> & { id: string }) => void,
  ) => {
    capturedRealtimeOnUpdate = onUpdate;
  },
}));
vi.mock("@/components/btc-qr-code", () => ({ BtcQrCode: () => <div data-testid="btc-qr" /> }));
vi.mock("./mark-sent-button", () => ({ MarkSentButton: () => null }));

beforeEach(() => {
  capturedWatcherOnStatusChange = null;
  capturedWatcherPaymentRevealed = undefined;
  capturedRealtimeOnUpdate = null;
});

const BASE_INVOICE: Invoice = {
  id: "inv-1",
  user_id: "u1",
  invoice_number: "INV-001",
  your_name: null,
  your_email: null,
  your_company: null,
  your_address: null,
  your_tax_id: null,
  client_name: "",
  client_email: "",
  client_company: null,
  client_address: null,
  client_tax_id: null,
  line_items: [{ description: "Work", quantity: 1, unit_price: 500 }],
  subtotal_fiat: 500,
  tax_fiat: 0,
  tax_percent: 0,
  total_fiat: 500,
  currency: "USD",
  btc_address: null,
  btc_txid: null,
  status: "pending",
  access_code: null,
  due_date: "2026-05-15",
  created_at: "2026-04-15T12:00:00Z",
  updated_at: "2026-04-15T12:00:00Z",
};

describe("InvoicePaymentView — download PDF", () => {
  it("renders a 'Download PDF' link wired to /api/invoice/[id]/pdf with the download attribute", () => {
    render(<InvoicePaymentView invoice={BASE_INVOICE} btcPrice={null} />);
    const link = screen.getByRole("link", { name: /download pdf/i }) as HTMLAnchorElement;
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/api/invoice/inv-1/pdf");
    expect(link.hasAttribute("download")).toBe(true);
  });
});

describe("InvoicePaymentView — dates", () => {
  it("shows 'Date Sent:' label with formatted date", () => {
    render(<InvoicePaymentView invoice={BASE_INVOICE} btcPrice={null} />);
    expect(screen.getByText(/date sent:/i)).toBeInTheDocument();
    expect(screen.getByText(/apr(il)? 15,? 2026/i)).toBeInTheDocument();
  });

  it("shows 'Date Due:' label with formatted date when due_date is present", () => {
    render(<InvoicePaymentView invoice={BASE_INVOICE} btcPrice={null} />);
    expect(screen.getByText(/date due:/i)).toBeInTheDocument();
    expect(screen.getByText(/may 15,? 2026/i)).toBeInTheDocument();
  });

  it("shows 'No due date' when due_date is null", () => {
    render(<InvoicePaymentView invoice={{ ...BASE_INVOICE, due_date: null }} btcPrice={null} />);
    expect(screen.getByText(/no due date/i)).toBeInTheDocument();
  });
});

describe("InvoicePaymentView — BTC reveal", () => {
  const BTC_INVOICE: Invoice = {
    ...BASE_INVOICE,
    btc_address: "tb1qtarget",
    status: "pending",
  };

  it("shows 'Pay now in Bitcoin' reveal button and hides the QR by default on a pending invoice", () => {
    render(<InvoicePaymentView invoice={BTC_INVOICE} btcPrice={50000} />);
    expect(screen.getByRole("button", { name: /pay now in bitcoin/i })).toBeInTheDocument();
    expect(screen.queryByTestId("btc-qr")).not.toBeInTheDocument();
  });

  it("reveals QR code + address after clicking 'Pay now in Bitcoin'", () => {
    render(<InvoicePaymentView invoice={BTC_INVOICE} btcPrice={50000} />);
    fireEvent.click(screen.getByRole("button", { name: /pay now in bitcoin/i }));
    expect(screen.getByTestId("btc-qr")).toBeInTheDocument();
    expect(screen.getByText(/tb1qtarget/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay now in bitcoin/i })).not.toBeInTheDocument();
  });

  it("auto-reveals QR details when the invoice is already payment_detected", () => {
    render(<InvoicePaymentView invoice={{ ...BTC_INVOICE, status: "payment_detected" }} btcPrice={50000} />);
    expect(screen.getByTestId("btc-qr")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay now in bitcoin/i })).not.toBeInTheDocument();
  });

  it("auto-reveals QR details when the invoice is already paid", () => {
    render(<InvoicePaymentView invoice={{ ...BTC_INVOICE, status: "paid" }} btcPrice={50000} />);
    expect(screen.getByTestId("btc-qr")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay now in bitcoin/i })).not.toBeInTheDocument();
  });
});

describe("InvoicePaymentView — copy buttons", () => {
  const BTC_INVOICE: Invoice = {
    ...BASE_INVOICE,
    btc_address: "tb1qtarget",
    status: "paid",
  };

  function mockClipboard() {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    return writeText;
  }

  it("copies the BTC amount when its copy button is clicked", async () => {
    const writeText = mockClipboard();
    // 500 USD / 50000 USD-per-BTC = 0.01 BTC
    render(<InvoicePaymentView invoice={BTC_INVOICE} btcPrice={50000} />);

    const btn = screen.getByRole("button", { name: /copy btc amount/i });
    fireEvent.click(btn);

    expect(writeText).toHaveBeenCalledWith("0.01");
  });

  it("copies the BTC address when its copy button is clicked", async () => {
    const writeText = mockClipboard();
    render(<InvoicePaymentView invoice={BTC_INVOICE} btcPrice={50000} />);

    const btn = screen.getByRole("button", { name: /copy btc address/i });
    fireEvent.click(btn);

    expect(writeText).toHaveBeenCalledWith("tb1qtarget");
  });
});

describe("InvoicePaymentView — txid live-update (v1.4.13)", () => {
  const BTC_INVOICE_PENDING: Invoice = {
    ...BASE_INVOICE,
    btc_address: "tb1qtarget",
    btc_txid: null,
    status: "pending",
  };

  it("renders the mempool.space txid link the moment the watcher reports a tx — no manual refresh required", () => {
    render(<InvoicePaymentView invoice={BTC_INVOICE_PENDING} btcPrice={50000} />);
    expect(capturedWatcherOnStatusChange).not.toBeNull();
    // Sanity: no txid link before detection.
    expect(screen.queryByText(/txid-from-watcher/)).not.toBeInTheDocument();

    act(() => {
      capturedWatcherOnStatusChange?.("payment_detected", "txid-from-watcher");
    });

    const link = screen.getByRole("link", { name: /txid-from-watcher/ }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://mempool.space/tx/txid-from-watcher");
  });

  it("on a fresh pending invoice, watcher mounts with paymentRevealed=false (window-shopper — WS only)", () => {
    render(<InvoicePaymentView invoice={BTC_INVOICE_PENDING} btcPrice={50000} />);
    expect(capturedWatcherPaymentRevealed).toBe(false);
  });

  it("after the payer clicks 'Pay now in Bitcoin', watcher receives paymentRevealed=true (active alongside-WS poll engaged)", () => {
    render(<InvoicePaymentView invoice={BTC_INVOICE_PENDING} btcPrice={50000} />);
    expect(capturedWatcherPaymentRevealed).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /pay now in bitcoin/i }));

    expect(capturedWatcherPaymentRevealed).toBe(true);
  });

  it("when invoice is already payment_detected, watcher mounts with paymentRevealed=true (auto-revealed)", () => {
    render(
      <InvoicePaymentView
        invoice={{ ...BTC_INVOICE_PENDING, status: "payment_detected" }}
        btcPrice={50000}
      />,
    );
    expect(capturedWatcherPaymentRevealed).toBe(true);
  });

  it("renders the mempool.space txid link when the realtime payload carries btc_txid (cron-only path)", () => {
    render(<InvoicePaymentView invoice={BTC_INVOICE_PENDING} btcPrice={50000} />);
    expect(capturedRealtimeOnUpdate).not.toBeNull();

    act(() => {
      capturedRealtimeOnUpdate?.({
        id: "inv-1",
        status: "payment_detected",
        btc_txid: "txid-from-realtime",
      });
    });

    const link = screen.getByRole("link", { name: /txid-from-realtime/ }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://mempool.space/tx/txid-from-realtime");
  });
});
