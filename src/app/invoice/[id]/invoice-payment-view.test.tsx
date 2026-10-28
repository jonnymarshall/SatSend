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
let capturedWatcherOverpaid: boolean | undefined = undefined;
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));
let capturedRealtimeOnUpdate:
  | ((next: Partial<Invoice> & { id: string }) => void)
  | null = null;

vi.mock("./payment-watcher", () => ({
  PaymentWatcher: (props: {
    onStatusChange: (s: Invoice["status"], txid?: string) => void;
    paymentRevealed?: boolean;
    overpaid?: boolean;
  }) => {
    capturedWatcherOnStatusChange = props.onStatusChange;
    capturedWatcherPaymentRevealed = props.paymentRevealed;
    capturedWatcherOverpaid = props.overpaid;
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
  capturedWatcherOverpaid = undefined;
  mockRefresh.mockClear();
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
  amount_received_fiat: null,
  amount_received_sats: null,
  btc_price_at_detection: null,
  email_attempted_at: null,
  mempool_seen_at: null,
  next_check_at: null,
  overpaid: false,
  pre_archive_status: null,
  payment_confirmed_at: null,
  published_at: null,
  send_method: null,
  sent_at: null,
  stage_attempt: 0,
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
  it("shows 'Invoice date:' as the day it was sent, not the day it was created (v1.5.19)", () => {
    render(
      <InvoicePaymentView invoice={{ ...BASE_INVOICE, sent_at: "2026-04-20T09:00:00Z" }} btcPrice={null} />,
    );
    expect(screen.getByText(/invoice date:/i)).toBeInTheDocument();
    expect(screen.queryByText(/date sent/i)).not.toBeInTheDocument();
    expect(screen.getByText(/apr(il)? 20,? 2026/i)).toBeInTheDocument();
    expect(screen.queryByText(/apr(il)? 15,? 2026/i)).not.toBeInTheDocument();
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

});

describe("InvoicePaymentView — copy buttons", () => {
  const BTC_INVOICE: Invoice = {
    ...BASE_INVOICE,
    btc_address: "tb1qtarget",
    status: "pending",
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
    fireEvent.click(screen.getByRole("button", { name: /pay now in bitcoin/i }));

    const btn = screen.getByRole("button", { name: /copy btc amount/i });
    fireEvent.click(btn);

    expect(writeText).toHaveBeenCalledWith("0.01");
  });

  it("copies the BTC address when its copy button is clicked", async () => {
    const writeText = mockClipboard();
    render(<InvoicePaymentView invoice={BTC_INVOICE} btcPrice={50000} />);
    fireEvent.click(screen.getByRole("button", { name: /pay now in bitcoin/i }));

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

describe("InvoicePaymentView — no payable QR once paid (v1.5.27)", () => {
  const PENDING: Invoice = { ...BASE_INVOICE, btc_address: "tb1qtarget", status: "pending" };
  const DETECTED: Invoice = { ...PENDING, status: "payment_detected", btc_txid: "txid-1" };
  const PAID: Invoice = {
    ...PENDING,
    status: "paid",
    btc_txid: "txid-1",
    amount_received_sats: 1_000_000,
    amount_received_fiat: 500,
  };

  const expectNothingPayable = () => {
    expect(screen.queryByTestId("btc-qr")).not.toBeInTheDocument();
    expect(screen.queryByText(/btc amount/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/BTC/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay now in bitcoin/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/pay with bitcoin/i)).not.toBeInTheDocument();
  };

  it("an unpaid invoice still offers the QR and amount", () => {
    render(<InvoicePaymentView invoice={PENDING} btcPrice={50000} />);
    fireEvent.click(screen.getByRole("button", { name: /pay now in bitcoin/i }));
    expect(screen.getByTestId("btc-qr")).toBeInTheDocument();
    expect(screen.getByText("0.01 BTC")).toBeInTheDocument();
  });

  it("payment detected: no QR or amount; the txid link and address remain", () => {
    render(<InvoicePaymentView invoice={DETECTED} btcPrice={50000} />);
    expectNothingPayable();
    expect(screen.getByRole("heading", { name: /payment detected/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "txid-1" })).toHaveAttribute("href", "https://mempool.space/tx/txid-1");
    expect(screen.getByText("tb1qtarget")).toBeInTheDocument();
  });

  it("paid: no QR; says what arrived at the address, never that SatSend received it", () => {
    const { container } = render(<InvoicePaymentView invoice={PAID} btcPrice={50000} />);
    expectNothingPayable();
    expect(screen.getByRole("heading", { name: /^paid$/i })).toBeInTheDocument();
    expect(document.getElementById("invoice-view--payment-sum-received")!.textContent).toContain("$500.00");
    expect(container.textContent).not.toMatch(/was received/);
    expect(document.getElementById("invoice-view--payment-received-message")).toBeNull();
    expect(container.textContent).not.toMatch(/\bwe\b/i);
  });

  it("underpaid: Jonny's wording, naming the sender, under the sums (v1.5.27)", () => {
    const { container } = render(
      <InvoicePaymentView
        invoice={{
          ...PAID,
          status: "underpaid",
          amount_received_sats: 123_000,
          amount_received_fiat: 61.5,
          your_company: "Maya Design Ltd",
        }}
        btcPrice={50000}
      />,
    );
    expectNothingPayable();
    expect(container.textContent).toContain(
      "To resolve full settlement of this invoice, reach out to Maya Design Ltd.",
    );
    expect(container.textContent).not.toMatch(/\bwe\b/i);
  });

  it("a paid invoice shows no QR even when the price service is down, and doesn't ask for a manual amount", () => {
    render(<InvoicePaymentView invoice={PAID} btcPrice={null} />);
    expectNothingPayable();
    expect(screen.queryByText(/price unavailable/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "txid-1" })).toBeInTheDocument();
  });

  it("a txid arriving by the watcher hides an open QR in the same visit", () => {
    render(<InvoicePaymentView invoice={PENDING} btcPrice={50000} />);
    fireEvent.click(screen.getByRole("button", { name: /pay now in bitcoin/i }));
    expect(screen.getByTestId("btc-qr")).toBeInTheDocument();
    act(() => capturedWatcherOnStatusChange?.("payment_detected", "txid-w"));
    expectNothingPayable();
    expect(screen.getByRole("link", { name: "txid-w" })).toBeInTheDocument();
  });

  it("a txid arriving by realtime hides an open QR in the same visit", () => {
    render(<InvoicePaymentView invoice={PENDING} btcPrice={50000} />);
    fireEvent.click(screen.getByRole("button", { name: /pay now in bitcoin/i }));
    act(() => capturedRealtimeOnUpdate?.({ id: "inv-1", status: "payment_detected", btc_txid: "txid-r" }));
    expectNothingPayable();
  });

  it("a later price change can't bring the QR back", () => {
    const { rerender } = render(<InvoicePaymentView invoice={PAID} btcPrice={50000} />);
    rerender(<InvoicePaymentView invoice={PAID} btcPrice={61000} />);
    expectNothingPayable();
  });
});

// v1.5.27: the block says at a glance which state it's in (icon + colour per
// state), shows the sums when the amount was wrong, and when it happened.
describe("InvoicePaymentView — payment block design (v1.5.27)", () => {
  const PAID: Invoice = {
    ...BASE_INVOICE,
    btc_address: "tb1qtarget",
    status: "paid",
    btc_txid: "txid-1",
    total_fiat: 100,
    amount_received_sats: 200_000,
    amount_received_fiat: 100,
    mempool_seen_at: "2026-10-27T12:18:00Z",
    payment_confirmed_at: "2026-10-27T12:32:00Z",
    your_company: "Maya Design Ltd",
  };
  const OVERPAID: Invoice = { ...PAID, amount_received_sats: 224_000, amount_received_fiat: 112, overpaid: true };
  const UNDERPAID: Invoice = { ...PAID, status: "underpaid", amount_received_sats: 123_000, amount_received_fiat: 61.5 };
  const block = () => document.getElementById("invoice-view--payment-received")!;
  const sumRow = (name: string) => document.getElementById(`invoice-view--payment-sum-${name}`)?.textContent;

  it("paid: green state, the sums with nothing outstanding, and when it confirmed", () => {
    render(<InvoicePaymentView invoice={PAID} btcPrice={50000} />);
    expect(block()).toHaveAttribute("data-state", "paid");
    expect(screen.getByText("Paid on")).toBeInTheDocument();
    expect(document.getElementById("invoice-view--payment-time")!.textContent).toMatch(/Oct 27, 2026/);
    expect(sumRow("requested")).toContain("$100.00");
    expect(sumRow("received")).toContain("0.002 BTC");
    expect(sumRow("outstanding")).toContain("Outstanding");
    expect(sumRow("outstanding")).toContain("$0.00");
  });

  it("paid within the 5% allowance still shows nothing outstanding", () => {
    render(<InvoicePaymentView invoice={{ ...PAID, amount_received_fiat: 98 }} btcPrice={50000} />);
    expect(sumRow("outstanding")).toMatch(/\$0\.00$/);
  });

  // Jonny, 2026-10-27: a visible gap above "Outstanding $0.00" looks like a
  // maths mistake, so a paid-within-the-allowance gap gets its own row.
  it("paid a little over: an exchange rate difference row explains the gap", () => {
    render(<InvoicePaymentView invoice={{ ...PAID, amount_received_fiat: 100.125 }} btcPrice={50000} />);
    expect(sumRow("rate")).toMatch(/^Exchange Rate Variance\+\$0\.13$/);
    expect(sumRow("outstanding")).toMatch(/\$0\.00$/);
  });

  it("the variance has a help button explaining it, for clients who wonder (Jonny, 2026-10-27)", async () => {
    render(<InvoicePaymentView invoice={{ ...PAID, amount_received_fiat: 100.75 }} btcPrice={50000} />);
    const help = screen.getByRole("button", { name: /what is exchange rate variance/i });
    fireEvent.click(help);
    expect(await screen.findByText(/counts as paid in full/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bwe\b/i);
  });

  it("paid a little under: the difference shows as negative", () => {
    render(<InvoicePaymentView invoice={{ ...PAID, amount_received_fiat: 98 }} btcPrice={50000} />);
    expect(sumRow("rate")).toMatch(/−\$2\.00$/);
  });

  it("an exact payment has no exchange rate row", () => {
    render(<InvoicePaymentView invoice={PAID} btcPrice={50000} />);
    expect(sumRow("rate")).toBeUndefined();
  });

  it("underpaid and overpaid don't get the row (their Outstanding is the real gap)", () => {
    const { unmount } = render(<InvoicePaymentView invoice={UNDERPAID} btcPrice={50000} />);
    expect(sumRow("rate")).toBeUndefined();
    unmount();
    render(<InvoicePaymentView invoice={OVERPAID} btcPrice={50000} />);
    expect(sumRow("rate")).toBeUndefined();
  });

  it("overpaid: its own state, the sums, and the approved wording", () => {
    const { container } = render(<InvoicePaymentView invoice={OVERPAID} btcPrice={50000} />);
    expect(block()).toHaveAttribute("data-state", "overpaid");
    expect(screen.getByRole("heading", { name: /^overpaid$/i })).toBeInTheDocument();
    expect(sumRow("requested")).toContain("$100.00");
    expect(sumRow("received")).toContain("$112.00");
    expect(sumRow("received")).toContain("0.00224 BTC");
    expect(sumRow("outstanding")).toMatch(/−\$12\.00$/);
    expect(container.textContent).toContain(
      "To resolve overpayment of this invoice, reach out to Maya Design Ltd.",
    );
    expect(container.textContent).not.toMatch(/\bwe\b/i);
  });

  it("overpaid: the status badge says Overpaid too", () => {
    render(<InvoicePaymentView invoice={OVERPAID} btcPrice={50000} />);
    expect(capturedWatcherOverpaid).toBe(true);
  });

  it("underpaid: amber state with the rest outstanding", () => {
    render(<InvoicePaymentView invoice={UNDERPAID} btcPrice={50000} />);
    expect(block()).toHaveAttribute("data-state", "underpaid");
    expect(sumRow("outstanding")).toMatch(/Outstanding\$38\.50$/);
  });

  it("an archived overpaid invoice still reads as overpaid", () => {
    render(<InvoicePaymentView invoice={{ ...OVERPAID, status: "archived", pre_archive_status: "paid" }} btcPrice={50000} />);
    expect(block()).toHaveAttribute("data-state", "overpaid");
  });

  it("payment detected: shows when it was seen", () => {
    render(
      <InvoicePaymentView
        invoice={{ ...PAID, status: "payment_detected", amount_received_sats: null, amount_received_fiat: null, payment_confirmed_at: null }}
        btcPrice={50000}
      />,
    );
    expect(block()).toHaveAttribute("data-state", "payment_detected");
    expect(screen.getByText("Seen at")).toBeInTheDocument();
    expect(screen.getByText(/usually within about 20 minutes\.$/)).toBeInTheDocument();
  });

  it("a paid invoice from before confirmation times were kept falls back to when it was seen", () => {
    render(<InvoicePaymentView invoice={{ ...PAID, payment_confirmed_at: null }} btcPrice={50000} />);
    expect(screen.queryByText("Paid on")).toBeNull();
    expect(screen.getByText("Seen at")).toBeInTheDocument();
  });

  it("an invoice marked paid by hand shows no time", () => {
    render(<InvoicePaymentView invoice={{ ...PAID, mempool_seen_at: null, payment_confirmed_at: null }} btcPrice={50000} />);
    expect(document.getElementById("invoice-view--payment-time")).toBeNull();
  });

  it("the full address stays visible, so the payer can check it", () => {
    render(<InvoicePaymentView invoice={PAID} btcPrice={50000} />);
    expect(screen.getByText("tb1qtarget")).toBeInTheDocument();
  });

  it("the transaction ID is shown in full, shortened only on a phone", () => {
    const txid = "e2e0000000000000000000000000000000000000000000000000000000000001";
    render(<InvoicePaymentView invoice={{ ...PAID, btc_txid: txid }} btcPrice={50000} />);
    const link = document.getElementById("invoice-view--btc-txid")!;
    expect(document.getElementById("invoice-view--btc-txid-full")).toHaveTextContent(txid);
    expect(document.getElementById("invoice-view--btc-txid-full")).toHaveClass("hidden", "sm:inline");
    expect(document.getElementById("invoice-view--btc-txid-short")).toHaveTextContent("e2e00000…00000001");
    expect(document.getElementById("invoice-view--btc-txid-short")).toHaveClass("sm:hidden");
    expect(link).toHaveAttribute("href", `https://mempool.space/tx/${txid}`);
  });

  it("a live status change to paid reloads the invoice's figures from the server", () => {
    render(<InvoicePaymentView invoice={{ ...PAID, status: "payment_detected" }} btcPrice={50000} />);
    expect(mockRefresh).not.toHaveBeenCalled();
    act(() => capturedRealtimeOnUpdate?.({ id: "inv-1", status: "paid", btc_txid: "txid-1" }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
