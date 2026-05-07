import { describe, it, expect } from "vitest";
import { canMarkAsUnpaid } from "./manual-confirmation";

// v1.4.14 — "Mark as unpaid" must only render for invoices that reached `paid`
// via a manual confirmation. On-chain-confirmed invoices cannot be reverted
// without also replacing the BTC address (else future detections collide with
// the old tx). Unknown / null confirmation method is treated as on-chain
// because every invoice that reached `paid` before v1.4.14 did so via the
// on-chain detection path.

describe("canMarkAsUnpaid — gate for the Mark-as-unpaid button", () => {
  it("manual confirmation → button visible", () => {
    expect(
      canMarkAsUnpaid({ status: "paid", payment_confirmation_method: "manual" }),
    ).toBe(true);
  });

  it("on-chain confirmation → button hidden", () => {
    expect(
      canMarkAsUnpaid({ status: "paid", payment_confirmation_method: "onchain" }),
    ).toBe(false);
  });

  it("legacy paid invoice with null confirmation method → treated as onchain (hidden)", () => {
    expect(
      canMarkAsUnpaid({ status: "paid", payment_confirmation_method: null }),
    ).toBe(false);
  });

  it("not yet paid → button hidden regardless of method", () => {
    expect(
      canMarkAsUnpaid({ status: "pending", payment_confirmation_method: null }),
    ).toBe(false);
    expect(
      canMarkAsUnpaid({ status: "marked_as_paid", payment_confirmation_method: "manual" }),
    ).toBe(false);
  });

  it("draft / archived → button hidden", () => {
    expect(
      canMarkAsUnpaid({ status: "draft", payment_confirmation_method: null }),
    ).toBe(false);
    expect(
      canMarkAsUnpaid({ status: "archived", payment_confirmation_method: "manual" }),
    ).toBe(false);
  });
});
