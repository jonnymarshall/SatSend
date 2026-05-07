import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/email/send", () => ({
  sendInvoiceMarkedPaidByPayerEmail: vi.fn().mockResolvedValue({ status: "sent" }),
}));
vi.mock("@/lib/invoice-events", () => ({ logInvoiceEvent: vi.fn().mockResolvedValue(undefined) }));

import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { sendInvoiceMarkedPaidByPayerEmail } from "@/lib/email/send";
import { logInvoiceEvent } from "@/lib/invoice-events";
import { markInvoicePaidByPayer } from "./actions";

type AnyAdmin = ReturnType<typeof createAdminClient>;

const PENDING_INVOICE = {
  id: "inv-1",
  user_id: "owner-1",
  status: "pending",
  invoice_number: "INV-001",
  client_name: "Acme Corp",
  client_email: "client@example.com",
  total_fiat: 1000,
  currency: "USD",
  your_name: "Sender",
  your_company: null,
  your_email: "sender@example.com",
  access_code: null,
  payment_method: null,
  payment_confirmation_method: null,
};

interface MakeAdminOpts {
  fetchData?: object | null;
  fetchError?: object | null;
  updateRowsAffected?: number;
  updateError?: { code?: string } | null;
  ownerEmail?: string | null;
}

function makeAdmin({
  fetchData = PENDING_INVOICE as object | null,
  fetchError = null as object | null,
  updateRowsAffected = 1,
  updateError = null as { code?: string } | null,
  ownerEmail = "owner@example.com" as string | null,
}: MakeAdminOpts = {}) {
  const fetchSingle = vi.fn().mockResolvedValue({ data: fetchData, error: fetchError });
  const fetchEq = vi.fn().mockReturnValue({ single: fetchSingle });

  // .update(...).eq(id).eq(status, prev).select() returns {data, error}
  // Idempotency model: when the row's status no longer equals 'pending'
  // (because a concurrent request already moved it), the conditional
  // update affects 0 rows — we surface that as an empty data array.
  const updateData = updateRowsAffected > 0 ? [{ id: "inv-1" }] : [];
  const updateSelect = vi.fn().mockResolvedValue({ data: updateData, error: updateError });
  const updateEqStatus = vi.fn().mockReturnValue({ select: updateSelect });
  const updateEqId = vi.fn().mockReturnValue({ eq: updateEqStatus });
  const updateChain = vi.fn().mockReturnValue({ eq: updateEqId });

  const selectChain = vi.fn().mockReturnValue({ eq: fetchEq });

  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn(() => ({ select: selectChain, update: updateChain })),
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: ownerEmail ? { email: ownerEmail } : null },
        }),
      },
    },
  } as unknown as AnyAdmin);

  return { fetchSingle, updateChain, updateSelect };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
});

describe("markInvoicePaidByPayer (fiat)", () => {
  it("transitions a pending invoice to marked_as_paid with fiat/manual fields and sends owner email", async () => {
    const { updateChain } = makeAdmin();

    const result = await markInvoicePaidByPayer("inv-1");

    expect(result.ok).toBe(true);
    // Verify the update payload sets the three fields the gate logic depends on.
    const updatePayload = updateChain.mock.calls[0][0];
    expect(updatePayload).toMatchObject({
      status: "marked_as_paid",
      payment_method: "fiat",
      payment_confirmation_method: "manual",
    });
    expect(sendInvoiceMarkedPaidByPayerEmail).toHaveBeenCalledTimes(1);
    expect(sendInvoiceMarkedPaidByPayerEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerEmail: "owner@example.com",
        invoiceId: "inv-1",
        invoiceNumber: "INV-001",
        currency: "USD",
        clientName: "Acme Corp",
      }),
    );
    expect(logInvoiceEvent).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: "inv-1", eventType: "marked_as_paid" }),
    );
  });

  it("works for an overdue invoice too (overdue → marked_as_paid)", async () => {
    const { updateChain } = makeAdmin({
      fetchData: { ...PENDING_INVOICE, status: "overdue" },
    });
    await markInvoicePaidByPayer("inv-1");
    const updatePayload = updateChain.mock.calls[0][0];
    expect(updatePayload.status).toBe("marked_as_paid");
  });

  it("is idempotent — when the row was already marked, no second email is sent", async () => {
    // Concurrent double-submit: the conditional update affected 0 rows
    // because another invocation already flipped status. We must not send
    // a duplicate email on the loser.
    makeAdmin({ updateRowsAffected: 0 });
    const result = await markInvoicePaidByPayer("inv-1");
    expect(result.ok).toBe(true);
    expect(sendInvoiceMarkedPaidByPayerEmail).not.toHaveBeenCalled();
    expect(logInvoiceEvent).not.toHaveBeenCalled();
  });

  it("rejects when the invoice is already paid", async () => {
    makeAdmin({ fetchData: { ...PENDING_INVOICE, status: "paid" } });
    const result = await markInvoicePaidByPayer("inv-1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toMatch(/not in a payable state/i);
    expect(sendInvoiceMarkedPaidByPayerEmail).not.toHaveBeenCalled();
  });

  it("rejects when the invoice is already marked_as_paid (no double-mark)", async () => {
    makeAdmin({ fetchData: { ...PENDING_INVOICE, status: "marked_as_paid" } });
    const result = await markInvoicePaidByPayer("inv-1");
    expect(result.ok).toBe(false);
    expect(sendInvoiceMarkedPaidByPayerEmail).not.toHaveBeenCalled();
  });

  it("rejects when the invoice is a draft", async () => {
    makeAdmin({ fetchData: { ...PENDING_INVOICE, status: "draft" } });
    const result = await markInvoicePaidByPayer("inv-1");
    expect(result.ok).toBe(false);
    expect(sendInvoiceMarkedPaidByPayerEmail).not.toHaveBeenCalled();
  });

  it("rejects when the invoice is not found", async () => {
    makeAdmin({ fetchData: null });
    const result = await markInvoicePaidByPayer("inv-1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toMatch(/not found/i);
  });

  it("rejects when an access_code is required and the cookie is missing", async () => {
    makeAdmin({ fetchData: { ...PENDING_INVOICE, access_code: "secret" } });
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const result = await markInvoicePaidByPayer("inv-1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toMatch(/access/i);
    expect(sendInvoiceMarkedPaidByPayerEmail).not.toHaveBeenCalled();
  });

  it("succeeds when an access_code is required and the cookie matches", async () => {
    makeAdmin({ fetchData: { ...PENDING_INVOICE, access_code: "secret" } });
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "secret" }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const result = await markInvoicePaidByPayer("inv-1");
    expect(result.ok).toBe(true);
    expect(sendInvoiceMarkedPaidByPayerEmail).toHaveBeenCalledTimes(1);
  });
});
