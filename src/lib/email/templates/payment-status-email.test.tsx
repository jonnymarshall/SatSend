import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import { PaymentStatusEmail, type PaymentStatusEmailProps } from "./payment-status-email";
import type { PaymentSummaryInvoice } from "@/lib/invoices/payment-summary";

// v1.5.28: the four payment emails carry the same block as the client's invoice
// page (state icon, sums, next step, time, address, transaction).

const TXID = "e2e0000000000000000000000000000000000000000000000000000000000001";
const ADDRESS = "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt";

const PAID: PaymentSummaryInvoice = {
  status: "paid",
  pre_archive_status: null,
  overpaid: false,
  total_fiat: 100,
  currency: "USD",
  amount_received_sats: 200_000,
  amount_received_fiat: 100,
  payment_confirmed_at: "2026-10-27T12:32:00Z",
  mempool_seen_at: "2026-10-27T12:18:00Z",
  slippage_tolerance_fiat: 1,
  your_company: "Maya Design Ltd",
  your_name: "Maya",
  client_company: null,
  client_name: "Acme Corp",
};

function props(over: Partial<PaymentStatusEmailProps> = {}): PaymentStatusEmailProps {
  return {
    audience: "client",
    payment: PAID,
    invoiceNumber: "INV-001",
    btcAddress: ADDRESS,
    txid: TXID,
    mempoolUrl: `https://mempool.space/testnet4/tx/${TXID}`,
    actionUrl: "https://satsend.me/invoice/inv-1",
    ...over,
  };
}

async function html(p: PaymentStatusEmailProps) {
  return render(<PaymentStatusEmail {...p} />);
}
async function text(p: PaymentStatusEmailProps) {
  return render(<PaymentStatusEmail {...p} />, { plainText: true });
}

describe("PaymentStatusEmail", () => {
  it("paid, to the client: the state icon, the sums, the time in UTC, the full address and transaction", async () => {
    const out = await html(props());
    const plain = await text(props());
    expect(out).toContain('src="cid:satsend-status-paid"');
    expect(plain).toContain("Paid");
    expect(plain).toContain("Invoice INV-001 from Maya Design Ltd");
    expect(plain).toMatch(/Requested:\s+\$100\.00/);
    expect(plain).toMatch(/Received:\s+\$100\.00 \(0\.002 BTC\)/);
    expect(plain).toMatch(/Outstanding:\s+\$0\.00/);
    expect(plain).toMatch(/Paid on:\s+Oct 27, 2026, 12:32 PM UTC/);
    expect(plain).toContain(ADDRESS);
    expect(out).toContain(`href="https://mempool.space/testnet4/tx/${TXID}"`);
    expect(plain).toContain(TXID);
    expect(plain).toContain("View invoice");
  });

  it("to the sender: names the client and opens SatSend", async () => {
    const plain = await text(props({ audience: "sender", actionUrl: "https://satsend.me/invoices/inv-1" }));
    expect(plain).toContain("Invoice INV-001 to Acme Corp");
    expect(plain).toContain("Open in SatSend");
  });

  it("underpaid: the client is pointed to the sender, the sender to the client", async () => {
    const payment = { ...PAID, status: "underpaid" as const, amount_received_sats: 123_000, amount_received_fiat: 61.5 };
    const client = await text(props({ payment }));
    expect(await html(props({ payment }))).toContain('src="cid:satsend-status-underpaid"');
    expect(client).toMatch(/Outstanding:\s+\$38\.50/);
    expect(client).toContain("To resolve full settlement of this invoice, reach out to Maya Design Ltd.");
    expect(await text(props({ payment, audience: "sender" }))).toContain(
      "To resolve full settlement of this invoice, reach out to Acme Corp.",
    );
  });

  it("overpaid: its own icon, a negative outstanding and its sentence", async () => {
    const payment = { ...PAID, overpaid: true, amount_received_sats: 224_000, amount_received_fiat: 112 };
    expect(await html(props({ payment }))).toContain('src="cid:satsend-status-overpaid"');
    const plain = await text(props({ payment }));
    expect(plain).toMatch(/Outstanding:\s+−\$12\.00/);
    expect(plain).toContain("To resolve overpayment of this invoice, reach out to Maya Design Ltd.");
  });

  it("an exchange rate variance comes with its explanation (email has no hover)", async () => {
    const plain = await text(props({ payment: { ...PAID, amount_received_fiat: 100.75 } }));
    expect(plain).toMatch(/Settlement Variance:\s+\+\$0\.75/);
    expect(plain).toContain("counts as paid in full");
    expect(await text(props())).not.toContain("Settlement Variance");
  });

  it("payment detected: no sums, the waiting sentence, when it was seen", async () => {
    const payment = { ...PAID, status: "payment_detected" as const, amount_received_sats: null, amount_received_fiat: null, payment_confirmed_at: null };
    expect(await html(props({ payment }))).toContain('src="cid:satsend-status-payment-detected"');
    const plain = await text(props({ payment }));
    expect(plain).not.toContain("Outstanding");
    expect(plain).toContain("waiting for confirmation, usually within about 20 minutes.");
    expect(plain).toMatch(/Seen at:\s+Oct 27, 2026, 12:18 PM UTC/);
  });

  it("never says SatSend received anything", async () => {
    for (const payment of [
      PAID,
      { ...PAID, status: "underpaid" as const, amount_received_fiat: 61.5 },
      { ...PAID, overpaid: true, amount_received_fiat: 112 },
      { ...PAID, status: "payment_detected" as const, amount_received_fiat: null, amount_received_sats: null },
    ]) {
      for (const audience of ["client", "sender"] as const) {
        expect(await text(props({ payment, audience }))).not.toMatch(/\bwe\b/i);
      }
    }
  });
});
