import { describe, expect, it } from "vitest";
import { markAsOptions } from "./mark-as-options";

// The rules from the old Mark as menu's tests (v1.4.11 four cases, v1.5.27).
const labels = (args: Parameters<typeof markAsOptions>[0]) => markAsOptions(args).map((o) => o.label);

describe("markAsOptions: overdue / pending (the four cases)", () => {
  it("case #3: pending, no due date → paid + overdue", () => {
    expect(labels({ status: "pending", dueDate: null })).toEqual(["paid", "overdue"]);
  });

  it("case #2: pending, future due date → paid only (no manual overdue before the due date)", () => {
    expect(labels({ status: "pending", dueDate: "2099-12-31" })).toEqual(["paid"]);
  });

  it("case #1: pending, past due date → no overdue (the sweep flips it)", () => {
    expect(labels({ status: "pending", dueDate: "2020-01-01" })).not.toContain("overdue");
  });

  it("case #4: overdue, no due date → paid + pending", () => {
    expect(labels({ status: "overdue", dueDate: null })).toEqual(["paid", "pending"]);
  });

  it("overdue, future due date → no pending (case #4 needs no due date)", () => {
    expect(labels({ status: "overdue", dueDate: "2099-12-31" })).not.toContain("pending");
  });

  it("payment detected and underpaid count as unpaid → paid + overdue, no pending", () => {
    expect(labels({ status: "payment_detected", dueDate: null })).toEqual(["paid", "overdue"]);
    expect(labels({ status: "underpaid", dueDate: null })).toEqual(["paid", "overdue"]);
  });
});

describe("markAsOptions: paid invoices", () => {
  it("marked paid by hand → unpaid only, which sets it back to pending", () => {
    expect(markAsOptions({ status: "paid", dueDate: null })).toEqual([{ action: "unpaid", label: "unpaid" }]);
  });

  it("paid on the blockchain → nothing (v1.5.27)", () => {
    expect(markAsOptions({ status: "paid", dueDate: null, paidOnChain: true })).toEqual([]);
  });
});

describe("markAsOptions: drafts and archived", () => {
  it("offers nothing", () => {
    expect(markAsOptions({ status: "draft", dueDate: null })).toEqual([]);
    expect(markAsOptions({ status: "archived", dueDate: null })).toEqual([]);
  });
});
