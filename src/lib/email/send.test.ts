import { describe, it, expect, vi, beforeEach } from "vitest";
import type React from "react";

const mockResendSend = vi.fn();
const mockGetResend = vi.fn();
vi.mock("./client", () => ({
  getResend: () => mockGetResend(),
  getFromAddress: () => "SatSend <test@example.com>",
  getAppUrl: () => "https://app.test",
}));

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: (row: unknown) => mockInsert(table, row),
      update: (row: unknown) => mockUpdate(table, row),
    }),
  }),
}));

import {
  sendInvoicePublishedEmail,
  sendPaymentDetectedEmail,
  sendPaymentConfirmedEmail,
} from "./send";

const baseArgs = {
  to: "client@example.com",
  userId: "user-123",
  senderName: "Charles",
  clientName: "Ada",
  invoiceId: "inv-1",
  invoiceNumber: "INV-001",
  totalFiat: 500,
  currency: "USD",
  accessCode: "SECRET42",
  dueDateDisplay: "July 10, 2026",
};

beforeEach(() => {
  vi.clearAllMocks();

  // Default insert chain: returns { data: { id: "evt-1" } }
  mockInsert.mockReturnValue({
    select: () => ({
      single: () => Promise.resolve({ data: { id: "evt-1" }, error: null }),
    }),
  });

  // Default update chain: succeeds
  mockUpdate.mockReturnValue({
    eq: () => Promise.resolve({ data: null, error: null }),
  });

  // Default getResend returns a Resend-like client
  mockGetResend.mockReturnValue({ emails: { send: mockResendSend } });

  // Default Resend success
  mockResendSend.mockResolvedValue({ data: { id: "resend-msg-1" }, error: null });
});

describe("safeSend (via sendInvoicePublishedEmail)", () => {
  it("inserts a queued email_events row then marks it sent with the resend message id on success", async () => {
    await sendInvoicePublishedEmail(baseArgs);

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const [insertedTable, insertedRow] = mockInsert.mock.calls[0];
    expect(insertedTable).toBe("email_events");
    expect(insertedRow).toMatchObject({
      invoice_id: "inv-1",
      user_id: "user-123",
      email_type: "invoice_published",
      recipient: "client@example.com",
      status: "queued",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [updatedTable, updatedRow] = mockUpdate.mock.calls[0];
    expect(updatedTable).toBe("email_events");
    expect(updatedRow).toMatchObject({
      status: "sent",
      resend_message_id: "resend-msg-1",
    });
  });

  it("marks the row skipped_no_api_key and skips Resend when RESEND_API_KEY is missing", async () => {
    mockGetResend.mockReturnValueOnce(null);

    await sendInvoicePublishedEmail(baseArgs);

    expect(mockResendSend).not.toHaveBeenCalled();
    const [, insertedRow] = mockInsert.mock.calls[0];
    expect(insertedRow.status).toBe("queued");

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [, updatedRow] = mockUpdate.mock.calls[0];
    expect(updatedRow.status).toBe("skipped_no_api_key");
  });

  it("marks the row failed and captures the error message when Resend returns an error", async () => {
    mockResendSend.mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", message: "Recipient blocked" },
    });

    await sendInvoicePublishedEmail(baseArgs);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const [, updatedRow] = mockUpdate.mock.calls[0];
    expect(updatedRow.status).toBe("failed");
    expect(String(updatedRow.error_message)).toMatch(/Recipient blocked/);
  });

  it("does not throw when the email_events insert itself errors; reports failure outcome", async () => {
    mockInsert.mockReturnValueOnce({
      select: () => ({
        single: () => Promise.resolve({ data: null, error: { message: "db down" } }),
      }),
    });

    const outcome = await sendInvoicePublishedEmail(baseArgs);
    expect(outcome.status).toBe("failed");
  });

  it("returns { status: 'sent' } on successful send", async () => {
    const outcome = await sendInvoicePublishedEmail(baseArgs);
    expect(outcome).toEqual({ status: "sent" });
  });

  it("returns { status: 'failed', errorMessage } when Resend errors", async () => {
    mockResendSend.mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", message: "Recipient blocked" },
    });
    const outcome = await sendInvoicePublishedEmail(baseArgs);
    expect(outcome.status).toBe("failed");
    expect(outcome.errorMessage).toMatch(/Recipient blocked/);
  });

  it("returns { status: 'skipped_no_api_key' } when RESEND_API_KEY is missing", async () => {
    mockGetResend.mockReturnValueOnce(null);
    const outcome = await sendInvoicePublishedEmail(baseArgs);
    expect(outcome).toEqual({ status: "skipped_no_api_key" });
  });
});

describe("sendPaymentDetectedEmail", () => {
  const paymentArgs = {
    ownerEmail: "owner@example.com",
    payerEmail: "payer@example.com",
    userId: "user-1",
    invoiceId: "inv-1",
    invoiceNumber: "INV-1",
    senderName: "Charles",
    clientName: "Ada",
    totalFiat: 250,
    currency: "USD",
    txid: "tx-abc",
  };

  it("sends one email to the owner and one to the payer when both addresses are set", async () => {
    await sendPaymentDetectedEmail(paymentArgs);

    expect(mockResendSend).toHaveBeenCalledTimes(2);
    const recipients = mockResendSend.mock.calls.map((call) => call[0].to);
    expect(recipients).toContain("owner@example.com");
    expect(recipients).toContain("payer@example.com");
  });

  it("records two email_events rows — one per recipient", async () => {
    await sendPaymentDetectedEmail(paymentArgs);

    expect(mockInsert).toHaveBeenCalledTimes(2);
    const recipients = mockInsert.mock.calls.map(([, row]) => (row as { recipient: string }).recipient);
    expect(recipients).toContain("owner@example.com");
    expect(recipients).toContain("payer@example.com");
    for (const [, row] of mockInsert.mock.calls) {
      expect((row as { email_type: string }).email_type).toBe("payment_detected");
    }
  });

  it("skips the payer send when payerEmail is null", async () => {
    await sendPaymentDetectedEmail({ ...paymentArgs, payerEmail: null });

    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect(mockResendSend.mock.calls[0][0].to).toBe("owner@example.com");
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it("skips the payer send when payerEmail is an empty string", async () => {
    await sendPaymentDetectedEmail({ ...paymentArgs, payerEmail: "" });

    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect(mockResendSend.mock.calls[0][0].to).toBe("owner@example.com");
  });

  it("uses an owner-framed subject for the owner and a payer-framed subject for the payer", async () => {
    await sendPaymentDetectedEmail(paymentArgs);

    const ownerCall = mockResendSend.mock.calls.find((c) => c[0].to === "owner@example.com");
    const payerCall = mockResendSend.mock.calls.find((c) => c[0].to === "payer@example.com");
    expect(ownerCall?.[0].subject).toMatch(/INV-1/);
    expect(ownerCall?.[0].subject?.toLowerCase()).toMatch(/your client|payment/);
    expect(payerCall?.[0].subject?.toLowerCase()).toMatch(/your payment/);
  });

  it("renders a network-aware mempool URL inside the owner and payer emails — testnet4 (v1.4.12)", async () => {
    const originalEnv = process.env.NEXT_PUBLIC_BTC_NETWORK;
    process.env.NEXT_PUBLIC_BTC_NETWORK = "testnet4";
    vi.resetModules();
    const { sendPaymentDetectedEmail: send } = await import("./send");
    const { mempoolTxUrl } = await import("@/lib/btc-network");
    const { render } = await import("@react-email/render");

    await send({ ...paymentArgs, txid: "tx-xyz" });

    const expectedUrl = mempoolTxUrl("tx-xyz");
    expect(expectedUrl).toBe("https://mempool.space/testnet4/tx/tx-xyz");

    for (const call of mockResendSend.mock.calls) {
      const html = await render(call[0].react as React.ReactElement);
      expect(html).toContain(expectedUrl);
      expect(html).not.toContain('href="https://mempool.space/tx/tx-xyz"');
    }

    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_BTC_NETWORK;
    else process.env.NEXT_PUBLIC_BTC_NETWORK = originalEnv;
    vi.resetModules();
  });

  it("renders a network-aware mempool URL inside the owner and payer emails — mainnet (v1.4.12)", async () => {
    const originalEnv = process.env.NEXT_PUBLIC_BTC_NETWORK;
    delete process.env.NEXT_PUBLIC_BTC_NETWORK;
    vi.resetModules();
    const { sendPaymentDetectedEmail: send } = await import("./send");
    const { mempoolTxUrl } = await import("@/lib/btc-network");
    const { render } = await import("@react-email/render");

    await send({ ...paymentArgs, txid: "tx-xyz" });

    const expectedUrl = mempoolTxUrl("tx-xyz");
    expect(expectedUrl).toBe("https://mempool.space/tx/tx-xyz");

    for (const call of mockResendSend.mock.calls) {
      const html = await render(call[0].react as React.ReactElement);
      expect(html).toContain(expectedUrl);
    }

    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_BTC_NETWORK;
    else process.env.NEXT_PUBLIC_BTC_NETWORK = originalEnv;
    vi.resetModules();
  });
});

describe("sendPaymentConfirmedEmail", () => {
  const paymentArgs = {
    ownerEmail: "owner@example.com",
    payerEmail: "payer@example.com",
    userId: "user-1",
    invoiceId: "inv-1",
    invoiceNumber: "INV-1",
    senderName: "Charles",
    clientName: "Ada",
    totalFiat: 250,
    currency: "USD",
    txid: "tx-abc",
  };

  it("sends one email to the owner and one to the payer when both addresses are set", async () => {
    await sendPaymentConfirmedEmail(paymentArgs);

    expect(mockResendSend).toHaveBeenCalledTimes(2);
    const recipients = mockResendSend.mock.calls.map((call) => call[0].to);
    expect(recipients).toContain("owner@example.com");
    expect(recipients).toContain("payer@example.com");
  });

  it("skips the payer send when payerEmail is blank", async () => {
    await sendPaymentConfirmedEmail({ ...paymentArgs, payerEmail: null });

    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect(mockResendSend.mock.calls[0][0].to).toBe("owner@example.com");
  });

  it("renders distinct templates for the owner and the payer (no throw)", async () => {
    await expect(sendPaymentConfirmedEmail(paymentArgs)).resolves.toBeUndefined();
  });

  it("uses a partial-payment subject when status is underpaid", async () => {
    await sendPaymentConfirmedEmail({
      ...paymentArgs,
      status: "underpaid",
      amountReceivedFiat: 62.5,
    });

    const ownerCall = mockResendSend.mock.calls.find((call) => call[0].to === "owner@example.com");
    expect(ownerCall![0].subject).toMatch(/partial payment/i);
  });

  it("uses the standard confirmed subject when status is paid (default)", async () => {
    await sendPaymentConfirmedEmail(paymentArgs);

    const ownerCall = mockResendSend.mock.calls.find((call) => call[0].to === "owner@example.com");
    expect(ownerCall![0].subject).not.toMatch(/partial payment/i);
  });
});
