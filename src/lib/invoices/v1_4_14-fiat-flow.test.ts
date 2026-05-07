// v1.4.14 — integration coverage for the full fiat-payment lifecycle and
// the mark-as-unpaid gate. Each test orchestrates the same in-memory invoice
// row through multiple actions, asserting state at every transition rather
// than at one snapshot. This catches regressions where individual unit tests
// would still pass but the chained behaviour breaks.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/email/send", () => ({
  sendInvoicePublishedEmail: vi.fn().mockResolvedValue({ status: "sent" }),
  sendInvoiceMarkedPaidByPayerEmail: vi.fn().mockResolvedValue({ status: "sent" }),
  sendFiatPaymentConfirmedEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/invoice-events", () => ({ logInvoiceEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/mempool", () => ({ addressHasHistory: vi.fn().mockResolvedValue(false) }));

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logInvoiceEvent } from "@/lib/invoice-events";

import { markInvoicePaidByPayer } from "@/app/invoice/[id]/actions";
import {
  confirmMarkedAsPaid,
  disputeMarkedAsPaid,
  markUnpaid,
} from "@/app/(dashboard)/invoices/actions";

// Shared in-memory invoice that all the actions read from + write to via
// the mocked supabase client. This is the integration's "database".
interface InvoiceRow {
  id: string;
  user_id: string;
  status: string;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  total_fiat: number;
  currency: string;
  your_name: string | null;
  your_email: string | null;
  your_company: string | null;
  access_code: string | null;
  payment_method: "bitcoin" | "fiat" | "bitcoin_offchain" | null;
  payment_confirmation_method: "onchain" | "manual" | null;
  paid_at: string | null;
}

let row: InvoiceRow;

function freshInvoice(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: "inv-1",
    user_id: "owner-1",
    status: "pending",
    invoice_number: "INV-001",
    client_name: "Acme Corp",
    client_email: "client@example.com",
    total_fiat: 1000,
    currency: "USD",
    your_name: "Sender",
    your_email: "sender@example.com",
    your_company: null,
    access_code: null,
    payment_method: null,
    payment_confirmation_method: null,
    paid_at: null,
    ...overrides,
  };
}

// Build a mock Supabase client whose .from("invoices").update().eq().eq()
// chain mutates the shared `row` and whose .select().eq().single() returns
// it. Both the user-context (createClient) and the admin (createAdminClient)
// share the same behaviour — the actions don't care which one they got.
function buildMockClient(authUserId: string) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: authUserId } } }),
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: { email: "owner@example.com" } },
        }),
      },
    },
    from: vi.fn(() => {
      const select = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: row, error: null }),
        })),
      }));
      const update = vi.fn((patch: Partial<InvoiceRow>) => {
        const exec = () => {
          // Apply the patch, then return select-array semantics so the
          // markInvoicePaidByPayer idempotency check sees rowsAffected=1.
          row = { ...row, ...patch };
          return Promise.resolve({ data: [{ id: row.id }], error: null });
        };
        return {
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn().mockImplementation(exec),
              // also handle bare .eq().eq() (no .select())
              then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
                exec().then(resolve),
            })),
            // single .eq()
            then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
              exec().then(resolve),
          })),
        };
      });
      return { select, update };
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  row = freshInvoice();
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  } as unknown as Awaited<ReturnType<typeof cookies>>);

  const adminClient = buildMockClient("owner-1");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createAdminClient).mockReturnValue(adminClient as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient).mockResolvedValue(adminClient as any);
});

describe("v1.4.14 — full fiat flow integration", () => {
  it("payer marks → owner confirms → invoice ends up paid with fiat/manual fields preserved", async () => {
    // 1. Payer marks the invoice as paid via fiat from the public page.
    const payerResult = await markInvoicePaidByPayer("inv-1");
    expect(payerResult.ok).toBe(true);
    expect(row.status).toBe("marked_as_paid");
    expect(row.payment_method).toBe("fiat");
    expect(row.payment_confirmation_method).toBe("manual");

    // 2. Owner confirms from the dashboard. Method fields stay intact;
    // status flips to paid; paid_at gets stamped.
    await confirmMarkedAsPaid("inv-1");
    expect(row.status).toBe("paid");
    expect(row.payment_method).toBe("fiat");
    expect(row.payment_confirmation_method).toBe("manual");
    expect(row.paid_at).toBeTruthy();

    // Activity feed records both the payer's mark and the owner's confirm.
    expect(logInvoiceEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "marked_as_paid" }),
    );
    expect(logInvoiceEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment_confirmed" }),
    );
  });

  it("payer marks → owner disputes → invoice returns to pending with method fields cleared", async () => {
    await markInvoicePaidByPayer("inv-1");
    expect(row.status).toBe("marked_as_paid");

    await disputeMarkedAsPaid("inv-1");
    expect(row.status).toBe("pending");
    expect(row.payment_method).toBeNull();
    expect(row.payment_confirmation_method).toBeNull();
    expect(row.paid_at).toBeNull();
  });

  it("after a successful confirm, owner can still revert via Mark as unpaid (manual confirmation gate)", async () => {
    await markInvoicePaidByPayer("inv-1");
    await confirmMarkedAsPaid("inv-1");
    expect(row.status).toBe("paid");

    // Mark As Unpaid — should succeed because confirmation_method = manual.
    await markUnpaid("inv-1");
    expect(row.status).toBe("pending");
    expect(row.payment_confirmation_method).toBeNull();
  });
});

describe("v1.4.14 — on-chain confirmation cannot be reverted", () => {
  it("markUnpaid throws on an invoice that was confirmed on-chain", async () => {
    row = freshInvoice({
      status: "paid",
      payment_method: "bitcoin",
      payment_confirmation_method: "onchain",
      paid_at: "2026-04-01T00:00:00Z",
    });

    await expect(markUnpaid("inv-1")).rejects.toThrow(
      /on-chain payments cannot be reverted/i,
    );
    // Row state remains unchanged.
    expect(row.status).toBe("paid");
    expect(row.payment_confirmation_method).toBe("onchain");
  });

  it("markUnpaid throws on a legacy paid invoice (null method, treated as on-chain)", async () => {
    row = freshInvoice({ status: "paid", payment_confirmation_method: null });

    await expect(markUnpaid("inv-1")).rejects.toThrow(
      /on-chain payments cannot be reverted/i,
    );
    expect(row.status).toBe("paid");
  });
});
