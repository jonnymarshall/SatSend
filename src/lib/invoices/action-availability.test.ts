import { describe, it, expect } from "vitest";
import { sendAvailability, deleteAvailability, REASONS } from "./action-availability";

// v1.5.37 (roadmap v1.4.24): one place decides which actions an invoice can
// take. Unavailable actions are shown greyed out with the reason on hover,
// instead of being offered and then failing (or, for Delete, silently doing
// nothing).

const ADDRESS = "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt";
const DRAFT = {
  status: "draft" as const,
  btc_address: ADDRESS,
  client_email: "client@example.com",
  email_attempted_at: null,
};

describe("sendAvailability", () => {
  it("a ready draft can be sent every way", () => {
    expect(sendAvailability(DRAFT)).toEqual({ email: { ok: true }, byHand: { ok: true } });
  });

  it("a draft without a bitcoin address can't be sent any way, and says why", () => {
    for (const btc_address of [null, "", "   "]) {
      const s = sendAvailability({ ...DRAFT, btc_address });
      expect(s.email).toEqual({ ok: false, reason: REASONS.noAddress });
      expect(s.byHand).toEqual({ ok: false, reason: REASONS.noAddress });
    }
    expect(REASONS.noAddress).toBe("Add a bitcoin address to this draft before sending it.");
  });

  it("a draft with an invalid address can't be sent", () => {
    const s = sendAvailability({ ...DRAFT, btc_address: "not-an-address" });
    expect(s.email).toEqual({ ok: false, reason: REASONS.badAddress });
    expect(s.byHand).toEqual({ ok: false, reason: REASONS.badAddress });
  });

  it("no client email: only email is unavailable", () => {
    const s = sendAvailability({ ...DRAFT, client_email: null });
    expect(s.email).toEqual({ ok: false, reason: REASONS.noClientEmail });
    expect(s.byHand).toEqual({ ok: true });
  });

  it("an email already attempted: email is unavailable", () => {
    const s = sendAvailability({ ...DRAFT, status: "pending" as const, email_attempted_at: "2026-11-01T00:00:00Z" });
    expect(s.email).toEqual({ ok: false, reason: REASONS.emailAlreadyAttempted });
  });

  it("the address problem is named before the email ones", () => {
    const s = sendAvailability({ ...DRAFT, btc_address: null, client_email: null });
    expect(s.email).toEqual({ ok: false, reason: REASONS.noAddress });
  });
});

describe("deleteAvailability", () => {
  it("drafts can be deleted", () => {
    expect(deleteAvailability({ status: "draft" })).toEqual({ ok: true });
  });

  it("anything that has been sent can't, and points to Archive", () => {
    for (const status of ["pending", "payment_detected", "paid", "underpaid", "overdue", "archived"] as const) {
      expect(deleteAvailability({ status })).toEqual({ ok: false, reason: REASONS.notDraft });
    }
    expect(REASONS.notDraft).toBe("Only drafts can be deleted. You can archive a sent invoice instead.");
  });
});
