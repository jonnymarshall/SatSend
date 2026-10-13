import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetchAddressTxs = vi.fn();
vi.mock("@/lib/mempool", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mempool")>("@/lib/mempool");
  return { ...actual, fetchAddressTxs: (...a: unknown[]) => mockFetchAddressTxs(...a) };
});
vi.mock("@/lib/btc-price", () => ({ fetchBtcPrice: vi.fn().mockResolvedValue({ price: 50_000 }) }));
const mockSendDetected = vi.fn().mockResolvedValue(undefined);
const mockSendConfirmed = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email/send", () => ({
  sendPaymentDetectedEmail: (...a: unknown[]) => mockSendDetected(...a),
  sendPaymentConfirmedEmail: (...a: unknown[]) => mockSendConfirmed(...a),
}));

import { checkInvoicePayment, type CheckableInvoice } from "./check-invoice-payment";

const NOW = new Date("2026-10-13T12:00:00Z");
const ADDR = "tb1qaddr";

const detected: CheckableInvoice = {
  id: "inv-1",
  user_id: "owner-1",
  btc_address: ADDR,
  status: "payment_detected",
  mempool_seen_at: new Date(NOW.getTime() - 25 * 60_000).toISOString(),
  published_at: new Date(NOW.getTime() - 60 * 60_000).toISOString(),
  stage_attempt: 1,
  invoice_number: "INV-1",
  client_name: "Ada",
  client_email: "payer@example.com",
  total_fiat: 250,
  currency: "USD",
  btc_txid: "tx-1",
  your_name: "Charles",
  your_company: null,
  your_email: null,
};

// 250 USD at 50k = 500,000 sats, confirmed 3 blocks deep at tip 900,002.
const confirmedTx = {
  txid: "tx-1",
  status: { confirmed: true, block_height: 900_000 },
  vout: [{ scriptpubkey_address: ADDR, value: 500_000 }],
};
const unconfirmedTx = { txid: "tx-1", status: { confirmed: false }, vout: [{ scriptpubkey_address: ADDR, value: 500_000 }] };

/**
 * A tiny in-memory invoices table with the same optimistic-concurrency rule as
 * Postgres: update().eq("id").eq("status", expected) only matches while the
 * status is still `expected`.
 */
function fakeDb(initialStatus: string) {
  const row = { status: initialStatus };
  const updates: unknown[] = [];
  const client = {
    from: () => ({
      update: (payload: { status?: string }) => {
        const filters: Record<string, unknown> = {};
        const chain = {
          eq: (col: string, val: unknown) => {
            filters[col] = val;
            return chain;
          },
          select: async () => {
            if (filters.status !== row.status) return { data: [], error: null };
            updates.push(payload);
            if (payload.status) row.status = payload.status;
            return { data: [{ id: "inv-1" }], error: null };
          },
        };
        return chain;
      },
    }),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "owner@example.com" } } }) } },
  };
  return { client: client as never, row, updates };
}

beforeEach(() => vi.clearAllMocks());

describe("checkInvoicePayment", () => {
  it("with writeOnlyOnStatusChange, an unchanged check writes nothing (no schedule nudge, no realtime event)", async () => {
    mockFetchAddressTxs.mockResolvedValue([unconfirmedTx]);
    const db = fakeDb("payment_detected");
    const outcome = await checkInvoicePayment(db.client, detected, 900_002, NOW, { writeOnlyOnStatusChange: true });
    expect(outcome).toBe("unchanged");
    expect(db.updates).toHaveLength(0);
  });

  it("two overlapping checks of the same confirmed payment: one status change, one confirmation email", async () => {
    mockFetchAddressTxs.mockResolvedValue([confirmedTx]);
    const db = fakeDb("payment_detected");

    const outcomes = await Promise.all([
      checkInvoicePayment(db.client, detected, 900_002, NOW),
      checkInvoicePayment(db.client, detected, 900_002, NOW, { writeOnlyOnStatusChange: true }),
    ]);

    expect(outcomes.sort()).toEqual(["lost_race", "transitioned"]);
    expect(db.row.status).toBe("paid");
    expect(db.updates).toHaveLength(1);
    expect(mockSendConfirmed).toHaveBeenCalledTimes(1);
    expect(mockSendDetected).not.toHaveBeenCalled();
  });

  it("defers without writing when mempool.space is unreachable", async () => {
    mockFetchAddressTxs.mockResolvedValue(null);
    const db = fakeDb("payment_detected");
    expect(await checkInvoicePayment(db.client, detected, 900_002, NOW)).toBe("mempool_unreachable");
    expect(db.updates).toHaveLength(0);
  });
});
