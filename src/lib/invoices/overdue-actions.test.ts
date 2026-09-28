import { describe, it, expect } from "vitest";
import { canMarkAsOverdue, canMarkAsPending, decideOverdueFlip } from "./overdue-actions";

const FUTURE_DATE = "2099-12-31";
const PAST_DATE = "2020-01-01";

const NOW = new Date("2026-04-29T12:00:00.000Z");

describe("canMarkAsOverdue — when the manual button should appear", () => {
  it("case #3: no due date + pending → button visible", () => {
    expect(canMarkAsOverdue({ status: "pending", due_date: null })).toBe(true);
  });

  it("case #3 (variant): no due date + payment_detected → button visible", () => {
    // payment_detected is a transient on-chain state but the invoice is still
    // unpaid, so the owner can override to overdue.
    expect(canMarkAsOverdue({ status: "payment_detected", due_date: null })).toBe(true);
  });

  it("case #3 (variant): no due date + underpaid → button visible (still owed the shortfall)", () => {
    expect(canMarkAsOverdue({ status: "underpaid", due_date: null })).toBe(true);
  });

  it("case #1: pending + past due → button hidden (cron auto-flips)", () => {
    expect(canMarkAsOverdue({ status: "pending", due_date: PAST_DATE })).toBe(false);
  });

  it("case #2: pending + future due → button hidden (no manual flip allowed before due date)", () => {
    expect(canMarkAsOverdue({ status: "pending", due_date: FUTURE_DATE })).toBe(false);
  });

  it("paid invoice → button hidden", () => {
    expect(canMarkAsOverdue({ status: "paid", due_date: null })).toBe(false);
  });

  it("already overdue → button hidden", () => {
    expect(canMarkAsOverdue({ status: "overdue", due_date: null })).toBe(false);
  });

  it("draft invoice → button hidden", () => {
    expect(canMarkAsOverdue({ status: "draft", due_date: null })).toBe(false);
  });
});

describe("canMarkAsPending — when the reverse button should appear (case #4)", () => {
  it("case #4: no due date + overdue → button visible", () => {
    expect(canMarkAsPending({ status: "overdue", due_date: null })).toBe(true);
  });

  it("overdue + future due → button hidden (cron would not re-flip but this is not case #4)", () => {
    expect(canMarkAsPending({ status: "overdue", due_date: FUTURE_DATE })).toBe(false);
  });

  it("overdue + past due → button hidden (cron would re-flip immediately)", () => {
    expect(canMarkAsPending({ status: "overdue", due_date: PAST_DATE })).toBe(false);
  });

  it("pending → button hidden", () => {
    expect(canMarkAsPending({ status: "pending", due_date: null })).toBe(false);
  });

  it("paid → button hidden", () => {
    expect(canMarkAsPending({ status: "paid", due_date: null })).toBe(false);
  });
});

describe("decideOverdueFlip — cron auto-flip rules (case #1 only)", () => {
  it("pending + due date in the past → flips to overdue", () => {
    const decision = decideOverdueFlip(
      { status: "pending", due_date: "2026-04-28" },
      NOW
    );
    expect(decision).toEqual({ shouldFlip: true, newStatus: "overdue" });
  });

  it("pending + due date is today → does not flip (still has the rest of today)", () => {
    const decision = decideOverdueFlip(
      { status: "pending", due_date: "2026-04-29" },
      NOW
    );
    expect(decision).toEqual({ shouldFlip: false });
  });

  it("pending + due date in the future → does not flip", () => {
    const decision = decideOverdueFlip(
      { status: "pending", due_date: FUTURE_DATE },
      NOW
    );
    expect(decision).toEqual({ shouldFlip: false });
  });

  it("pending + no due date → does not flip", () => {
    const decision = decideOverdueFlip(
      { status: "pending", due_date: null },
      NOW
    );
    expect(decision).toEqual({ shouldFlip: false });
  });

  it("payment_detected + past due → does not flip (a payment is in flight; do not regress)", () => {
    const decision = decideOverdueFlip(
      { status: "payment_detected", due_date: PAST_DATE },
      NOW
    );
    expect(decision).toEqual({ shouldFlip: false });
  });

  it("paid + past due → does not flip", () => {
    const decision = decideOverdueFlip(
      { status: "paid", due_date: PAST_DATE },
      NOW
    );
    expect(decision).toEqual({ shouldFlip: false });
  });

  it("already overdue + past due → does not flip again", () => {
    const decision = decideOverdueFlip(
      { status: "overdue", due_date: PAST_DATE },
      NOW
    );
    expect(decision).toEqual({ shouldFlip: false });
  });
});
