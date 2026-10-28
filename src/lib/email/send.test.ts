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
const mockCount = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: (row: unknown) => mockInsert(table, row),
      update: (row: unknown) => mockUpdate(table, row),
      // Daily-cap count query: .select("id",{count,head}).eq(...).gte(...)
      select: () => ({ eq: () => ({ gte: () => mockCount(table) }) }),
    }),
  }),
}));

import {
  sendInvoicePublishedEmail,
  sendPaymentDetectedEmail,
  sendPaymentConfirmedEmail,
} from "./send";

// v1.5.28: the payment emails carry the payment block, built from this.
const PAYMENT = {
  status: "payment_detected" as const,
  pre_archive_status: null,
  overpaid: false,
  total_fiat: 250,
  currency: "USD",
  amount_received_sats: null,
  amount_received_fiat: null,
  payment_confirmed_at: null,
  mempool_seen_at: "2026-10-27T12:18:00Z",
  your_company: null,
  your_name: "Charles",
  client_company: null,
  client_name: "Ada",
};
const CONFIRMED = { ...PAYMENT, status: "paid" as const, amount_received_sats: 500_000, amount_received_fiat: 250, payment_confirmed_at: "2026-10-27T12:32:00Z" };

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

  // Default: under the daily send cap.
  mockCount.mockResolvedValue({ count: 0, error: null });

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

  it("skips (skipped_daily_cap) and inserts no row when the daily send cap is reached (v1.4.26-H)", async () => {
    mockCount.mockResolvedValueOnce({ count: 200, error: null });
    const outcome = await sendInvoicePublishedEmail(baseArgs);
    expect(outcome).toEqual({ status: "skipped_daily_cap" });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("does not block mail when the cap check itself errors (v1.4.26-H)", async () => {
    mockCount.mockRejectedValueOnce(new Error("db down"));
    const outcome = await sendInvoicePublishedEmail(baseArgs);
    expect(outcome.status).toBe("sent");
    expect(mockResendSend).toHaveBeenCalledTimes(1);
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
    btcAddress: "bc1qaddr",
    payment: PAYMENT,
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
    btcAddress: "bc1qaddr",
    payment: PAYMENT,
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

  // v1.5.28: subjects name the state; "Partial payment" became "Underpaid".
  it.each([
    ["paid", CONFIRMED, /INV-1 confirmed on-chain/i, /your payment for invoice INV-1 is confirmed/i],
    ["underpaid", { ...CONFIRMED, status: "underpaid" as const, amount_received_fiat: 62.5 }, /^Underpaid payment for invoice INV-1$/, /^Underpaid payment for invoice INV-1$/],
    ["overpaid", { ...CONFIRMED, overpaid: true, amount_received_fiat: 300 }, /^Overpayment received for invoice INV-1$/, /^Overpayment received for invoice INV-1$/],
  ])("%s: the subject names the state", async (_label, payment, ownerSubject, payerSubject) => {
    await sendPaymentConfirmedEmail({ ...paymentArgs, payment });
    const ownerCall = mockResendSend.mock.calls.find((call) => call[0].to === "owner@example.com");
    const payerCall = mockResendSend.mock.calls.find((call) => call[0].to === "payer@example.com");
    expect(ownerCall![0].subject).toMatch(ownerSubject);
    expect(payerCall![0].subject).toMatch(payerSubject);
  });

  it("the client's email points them to the sender, the sender's to the client", async () => {
    const { render } = await import("@react-email/render");
    await sendPaymentConfirmedEmail({ ...paymentArgs, payment: { ...CONFIRMED, status: "underpaid", amount_received_fiat: 62.5 } });
    const owner = mockResendSend.mock.calls.find((call) => call[0].to === "owner@example.com")![0];
    const payer = mockResendSend.mock.calls.find((call) => call[0].to === "payer@example.com")![0];
    expect(await render(payer.react, { plainText: true })).toContain("reach out to Charles.");
    expect(await render(owner.react, { plainText: true })).toContain("reach out to Ada.");
  });
});

describe("deliverability (v1.5.0.2-H): plain-text part and Reply-To", () => {
  const paymentArgs = {
    ownerEmail: "owner@example.com",
    payerEmail: "payer@example.com",
    userId: "user-1",
    invoiceId: "inv-1",
    invoiceNumber: "INV-1",
    senderName: "Charles",
    clientName: "Ada",
    totalFiat: 500,
    currency: "USD",
    txid: "tx-abc",
    btcAddress: "bc1qaddr",
    payment: PAYMENT,
  };

  it("every email carries a plain-text version alongside the HTML", async () => {
    await sendInvoicePublishedEmail({ ...baseArgs, replyTo: "charles@example.com" });
    await sendPaymentDetectedEmail(paymentArgs);
    await sendPaymentConfirmedEmail(paymentArgs);
    expect(mockResendSend).toHaveBeenCalledTimes(5);
    for (const [payload] of mockResendSend.mock.calls) {
      expect(typeof payload.text).toBe("string");
      expect(payload.text.length).toBeGreaterThan(40);
      expect(payload.text).not.toMatch(/<[a-z]/i);
    }
  });

  it("the invoice email's plain text includes the invoice link, written out", async () => {
    await sendInvoicePublishedEmail(baseArgs);
    expect(mockResendSend.mock.calls[0][0].text).toContain("https://app.test/invoice/inv-1");
  });

  it("the invoice email shows the invoice link as visible text, not only behind the button", async () => {
    const { render } = await import("@react-email/render");
    await sendInvoicePublishedEmail(baseArgs);
    const html = await render(mockResendSend.mock.calls[0][0].react as React.ReactElement);
    expect(html).toMatch(/>\s*https:\/\/app\.test\/invoice\/inv-1\s*</);
  });

  it("client emails reply to the invoice owner, so replies reach the freelancer", async () => {
    await sendInvoicePublishedEmail({ ...baseArgs, replyTo: "charles@example.com" });
    expect(mockResendSend.mock.calls[0][0].replyTo).toBe("charles@example.com");

    mockResendSend.mockClear();
    await sendPaymentDetectedEmail(paymentArgs);
    await sendPaymentConfirmedEmail(paymentArgs);
    for (const [payload] of mockResendSend.mock.calls) {
      if (payload.to === "payer@example.com") expect(payload.replyTo).toBe("owner@example.com");
      else expect(payload.replyTo).toBeUndefined();
    }
  });

  it("sets no Reply-To on the invoice email when the owner's address is unknown", async () => {
    await sendInvoicePublishedEmail({ ...baseArgs, replyTo: null });
    expect(mockResendSend.mock.calls[0][0]).not.toHaveProperty("replyTo");
  });
});

describe("logo embedded in the email (v1.5.12)", () => {
  // Proton Mail fetched the logo from satsend.me and still showed a broken
  // image, so emails we send carry the logo inline instead of linking to it.
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
    btcAddress: "bc1qaddr",
    payment: PAYMENT,
  };

  it("attaches the logo inline and the HTML points at it, not at a web address", async () => {
    const { render } = await import("@react-email/render");
    const { readFileSync } = await import("node:fs");
    const png = readFileSync("public/brand/satsend-logo-email.png").toString("base64");

    await sendInvoicePublishedEmail(baseArgs);
    await sendPaymentDetectedEmail(paymentArgs);
    await sendPaymentConfirmedEmail({ ...paymentArgs, payment: CONFIRMED });

    expect(mockResendSend.mock.calls.length).toBeGreaterThanOrEqual(5);
    for (const [payload] of mockResendSend.mock.calls) {
      expect(payload.attachments[0]).toEqual({
        filename: "satsend-logo.png",
        content: png,
        contentType: "image/png",
        contentId: "satsend-logo",
      });
      const html = await render(payload.react);
      expect(html).toContain('src="cid:satsend-logo"');
      expect(html).not.toContain("/brand/satsend-logo-email.png");
    }
  });

  // v1.5.28: payment emails also carry their state's icon, inline like the logo.
  it("payment emails attach their state's icon, the same picture as public/brand", async () => {
    const { render } = await import("@react-email/render");
    const { readFileSync } = await import("node:fs");
    await sendPaymentDetectedEmail(paymentArgs);
    await sendPaymentConfirmedEmail({ ...paymentArgs, payment: CONFIRMED });
    const [detectedOwner, , confirmedOwner] = mockResendSend.mock.calls.map(([p]) => p);
    for (const [payload, state, cid] of [
      [detectedOwner, "payment_detected", "satsend-status-payment-detected"],
      [confirmedOwner, "paid", "satsend-status-paid"],
    ] as const) {
      expect(payload.attachments[1]).toEqual({
        filename: `${cid}.png`,
        content: readFileSync(`public/brand/email-status-${state}.png`).toString("base64"),
        contentType: "image/png",
        contentId: cid,
      });
      expect(await render(payload.react)).toContain(`src="cid:${cid}"`);
    }
  });

  it("the invoice email carries only the logo", async () => {
    await sendInvoicePublishedEmail(baseArgs);
    expect(mockResendSend.mock.calls[0][0].attachments).toHaveLength(1);
  });
});
