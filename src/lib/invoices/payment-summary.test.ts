import { describe, it, expect } from "vitest";
import { paymentSummary, hasPayment, formatPaymentTime, shortTxid, type PaymentSummaryInvoice } from "./payment-summary";

// v1.5.28: one source for the payment block, read by the invoice page, the four
// payment emails and the PDF, so they can't drift apart.

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
  your_company: "Maya Design Ltd",
  your_name: "Maya",
  client_company: null,
  client_name: "Acme Corp",
};

describe("paymentSummary", () => {
  it("paid: green state, sums with nothing outstanding, no sentence, the confirmation time", () => {
    const s = paymentSummary(PAID, { audience: "client" });
    expect(s.state).toBe("paid");
    expect(s.heading).toBe("Paid");
    expect(s.sums).toEqual({
      requested: "$100.00",
      received: "$100.00",
      receivedBtc: "0.002 BTC",
      rateVariance: null,
      outstanding: "$0.00",
    });
    expect(s.message).toBeNull();
    expect(s.time).toEqual({ label: "Paid on", iso: "2026-10-27T12:32:00Z" });
  });

  it("paid within the allowance: the gap shows as an Exchange Rate Variance", () => {
    expect(paymentSummary({ ...PAID, amount_received_fiat: 100.75 }, { audience: "client" }).sums?.rateVariance).toBe("+$0.75");
    expect(paymentSummary({ ...PAID, amount_received_fiat: 98 }, { audience: "client" }).sums?.rateVariance).toBe("−$2.00");
  });

  it("paid beyond the allowance: no variance; the sender marked it paid", () => {
    const client = paymentSummary({ ...PAID, amount_received_fiat: 61.5 }, { audience: "client" });
    expect(client.sums?.rateVariance).toBeNull();
    expect(client.sums?.outstanding).toBe("$0.00");
    expect(client.message).toBe("Marked as paid by Maya Design Ltd.");
    expect(paymentSummary({ ...PAID, amount_received_fiat: 61.5 }, { audience: "sender" }).message).toBe("Marked as paid by you.");
  });

  it("paid with no amount recorded (marked paid by hand, no blockchain payment): no sums, says who marked it", () => {
    const s = paymentSummary({ ...PAID, amount_received_sats: null, amount_received_fiat: null, payment_confirmed_at: null, mempool_seen_at: null }, { audience: "client" });
    expect(s.sums).toBeNull();
    expect(s.message).toBe("Marked as paid by Maya Design Ltd.");
    expect(s.time).toBeNull();
  });

  it("underpaid: the rest outstanding; the client is pointed to the sender, the sender to the client", () => {
    const inv = { ...PAID, status: "underpaid" as const, amount_received_sats: 123_000, amount_received_fiat: 61.5 };
    const client = paymentSummary(inv, { audience: "client" });
    expect(client.state).toBe("underpaid");
    expect(client.sums?.outstanding).toBe("$38.50");
    expect(client.message).toBe("To resolve full settlement of this invoice, reach out to Maya Design Ltd.");
    expect(paymentSummary(inv, { audience: "sender" }).message).toBe(
      "To resolve full settlement of this invoice, reach out to Acme Corp.",
    );
  });

  it("overpaid: a negative outstanding and its own sentence", () => {
    const inv = { ...PAID, overpaid: true, amount_received_sats: 224_000, amount_received_fiat: 112 };
    const client = paymentSummary(inv, { audience: "client" });
    expect(client.state).toBe("overpaid");
    expect(client.heading).toBe("Overpaid");
    expect(client.sums?.outstanding).toBe("−$12.00");
    expect(client.message).toBe("To resolve overpayment of this invoice, reach out to Maya Design Ltd.");
    expect(paymentSummary(inv, { audience: "sender" }).message).toBe(
      "To resolve overpayment of this invoice, reach out to Acme Corp.",
    );
  });

  it("payment detected: no sums, the waiting sentence, when it was seen", () => {
    const s = paymentSummary(
      { ...PAID, status: "payment_detected", amount_received_sats: null, amount_received_fiat: null, payment_confirmed_at: null },
      { audience: "client" },
    );
    expect(s.state).toBe("payment_detected");
    expect(s.sums).toBeNull();
    expect(s.message).toMatch(/waiting for confirmation, usually within about 20 minutes\.$/);
    expect(s.time).toEqual({ label: "Seen at", iso: "2026-10-27T12:18:00Z" });
  });

  it("an archived invoice reads as what it was", () => {
    expect(paymentSummary({ ...PAID, status: "archived", pre_archive_status: "paid", overpaid: true, amount_received_fiat: 112 }, { audience: "client" }).state).toBe("overpaid");
  });

  it("a status passed in (from a live update) wins over the stored one", () => {
    expect(paymentSummary(PAID, { audience: "client", status: "payment_detected" }).state).toBe("payment_detected");
  });

  it("names fall back sensibly", () => {
    const inv = { ...PAID, status: "underpaid" as const, amount_received_fiat: 61.5, your_company: null, your_name: null, client_name: "" };
    expect(paymentSummary(inv, { audience: "client" }).message).toContain("reach out to the sender of this invoice.");
    expect(paymentSummary(inv, { audience: "sender" }).message).toContain("reach out to your client.");
  });

  it("client_company wins over client_name for the sender, as your_company does for the client", () => {
    const inv = { ...PAID, status: "underpaid" as const, amount_received_fiat: 61.5, client_company: "Acme Holdings" };
    expect(paymentSummary(inv, { audience: "sender" }).message).toContain("reach out to Acme Holdings.");
  });

  it("never says SatSend received anything", () => {
    for (const inv of [
      PAID,
      { ...PAID, status: "underpaid" as const, amount_received_fiat: 61.5 },
      { ...PAID, overpaid: true, amount_received_fiat: 112 },
      { ...PAID, status: "payment_detected" as const, amount_received_fiat: null, amount_received_sats: null },
    ]) {
      for (const audience of ["client", "sender"] as const) {
        expect(JSON.stringify(paymentSummary(inv, { audience }))).not.toMatch(/\bwe\b/i);
      }
    }
  });
});

describe("hasPayment", () => {
  it("is true for a txid or any paid status", () => {
    expect(hasPayment("pending", "tx")).toBe(true);
    expect(hasPayment("payment_detected", null)).toBe(true);
    expect(hasPayment("paid", null)).toBe(true);
    expect(hasPayment("underpaid", null)).toBe(true);
    expect(hasPayment("pending", null)).toBe(false);
    expect(hasPayment("overdue", null)).toBe(false);
  });
});

describe("formatPaymentTime", () => {
  it("names the time zone", () => {
    expect(formatPaymentTime("2026-10-27T12:32:00Z", "UTC")).toBe("Oct 27, 2026, 12:32 PM UTC");
  });
});

describe("shortTxid", () => {
  it("shortens a long txid, leaves a short one", () => {
    expect(shortTxid("e2e0000000000000000000000000000000000000000000000000000000000001")).toBe("e2e00000…00000001");
    expect(shortTxid("txid-1")).toBe("txid-1");
  });
});
