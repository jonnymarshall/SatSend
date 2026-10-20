import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/invoices/check-invoice-payment", () => ({
  CHECKABLE_COLUMNS: "id",
  CHECKABLE_STATUSES: ["pending", "payment_detected", "overdue"],
  checkInvoicePayment: vi.fn(),
}));

import { rescheduleStoppedWatches, sweepDueInvoices } from "./sweep-due";
import type { CheckOutcome } from "./check-invoice-payment";

const NOW = new Date("2026-10-20T12:00:00Z");
const VALID = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";

/** Due-queue query stub: each call to .limit() returns the next page. */
function dueDb(pages: { id: string }[][], fetchError: unknown = null) {
  let call = 0;
  const chain = {
    select: () => chain,
    in: () => chain,
    lte: () => chain,
    order: () => chain,
    limit: async () => (fetchError ? { data: null, error: fetchError } : { data: pages[call++] ?? [], error: null }),
  };
  return { from: () => chain } as never;
}

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `inv-${i}` }));

describe("sweepDueInvoices (v1.5.13 time budget)", () => {
  it("checks every due invoice when there is time", async () => {
    const check = vi.fn(async (): Promise<CheckOutcome> => "unchanged");
    const result = await sweepDueInvoices(dueDb([rows(3)]), 900_000, { now: () => NOW, check });
    expect(check).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ processed: 3, budgetReached: false, fetchFailed: false });
  });

  it("stops starting new checks once the budget is spent, leaving the rest due", async () => {
    let clock = 0;
    const check = vi.fn(async (): Promise<CheckOutcome> => {
      clock += 6_000; // a slow mempool.space minute
      return "unchanged";
    });
    const result = await sweepDueInvoices(dueDb([rows(10)]), 900_000, {
      now: () => NOW,
      clock: () => clock,
      startedAt: 0,
      budgetMs: 15_000,
      check,
    });
    // Starts at 0, 6s and 12s; at 18s the budget is spent.
    expect(check).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ processed: 3, budgetReached: true });
  });

  it("counts transitions, errors and invalid addresses", async () => {
    const outcomes: CheckOutcome[] = ["transitioned", "error", "mempool_unreachable", "invalid_address", "unchanged"];
    const check = vi.fn(async () => outcomes.shift()!);
    const result = await sweepDueInvoices(dueDb([rows(5)]), 900_000, { now: () => NOW, check });
    expect(result).toMatchObject({ processed: 5, transitions: 1, errors: 2, invalid: 1 });
  });

  it("reports a failed due-queue read so the route can fail loudly", async () => {
    const check = vi.fn();
    const result = await sweepDueInvoices(dueDb([], { message: "db down" }), 900_000, { now: () => NOW, check });
    expect(result.fetchFailed).toBe(true);
    expect(check).not.toHaveBeenCalled();
  });
});

describe("rescheduleStoppedWatches", () => {
  function stoppedDb(candidates: { id: string; btc_address: string }[]) {
    const updatedIds: string[][] = [];
    const selectChain = {
      in: () => selectChain,
      is: () => selectChain,
      not: async () => ({ data: candidates, error: null }),
    };
    const updateChain = (ids: string[] = []) => ({
      in: (_col: string, v: string[]) => updateChain(v),
      is: () => ({
        select: async () => {
          updatedIds.push(ids);
          return { data: ids.map((id) => ({ id })), error: null };
        },
      }),
    });
    const db = { from: () => ({ select: () => selectChain, update: () => updateChain() }) };
    return { db: db as never, updatedIds };
  }

  it("puts stopped watches back on the schedule, but not ones whose address can't be checked", async () => {
    const { db, updatedIds } = stoppedDb([
      { id: "ok", btc_address: VALID },
      { id: "testnet", btc_address: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx" },
      { id: "junk", btc_address: "fsgdfbngf" },
    ]);
    expect(await rescheduleStoppedWatches(db, NOW)).toBe(1);
    expect(updatedIds).toEqual([["ok"]]);
  });

  it("writes nothing when every stopped watch has an uncheckable address", async () => {
    const { db, updatedIds } = stoppedDb([{ id: "junk", btc_address: "fsgdfbngf" }]);
    expect(await rescheduleStoppedWatches(db, NOW)).toBe(0);
    expect(updatedIds).toEqual([]);
  });
});
