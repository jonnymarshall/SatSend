import { describe, it, expect } from "vitest";
import { clientInvoiceUrl, emailOutcomeMessage } from "./send-feedback";

// v1.5.19: one wording for every Send button (invoice page, list, editor).
describe("emailOutcomeMessage", () => {
  it("confirms a sent email", () => {
    expect(emailOutcomeMessage("sent", { wasDraft: true, clientEmail: "ada@example.com" })).toEqual({
      tone: "notice",
      text: expect.stringContaining("ada@example.com"),
    });
  });

  it.each(["failed", "skipped_no_api_key", "skipped_daily_cap"] as const)(
    "%s on a draft says nothing was sent and it's still a draft",
    (status) => {
      const m = emailOutcomeMessage(status, { wasDraft: true, clientEmail: "ada@example.com" });
      expect(m.tone).toBe("error");
      expect(m.text).toMatch(/still a draft/i);
      expect(m.text).not.toMatch(/published/i);
    },
  );

  it("never mentions publishing", () => {
    for (const status of ["sent", "failed", "skipped_no_api_key", "skipped_daily_cap", "no_recipient"] as const) {
      for (const wasDraft of [true, false]) {
        expect(emailOutcomeMessage(status, { wasDraft, clientEmail: null }).text).not.toMatch(/publish/i);
      }
    }
  });
});

describe("clientInvoiceUrl", () => {
  it("is the client's page on this site", () => {
    expect(clientInvoiceUrl("abc", "https://satsend.me")).toBe("https://satsend.me/invoice/abc");
  });
});
