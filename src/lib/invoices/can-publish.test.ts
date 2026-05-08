import { describe, it, expect } from "vitest";
import { canPublishInvoice } from "./can-publish";

describe("canPublishInvoice", () => {
  it("blocks publish when btc_address is missing", () => {
    const result = canPublishInvoice({ btc_address: null });
    expect(result).toEqual({ ok: false, error: "btc_address_required" });
  });

  it("allows publish for a valid btc_address", () => {
    const result = canPublishInvoice({
      btc_address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    });
    expect(result).toEqual({ ok: true });
  });

  it("blocks publish when btc_address is malformed", () => {
    const result = canPublishInvoice({ btc_address: "not-an-address" });
    expect(result).toEqual({ ok: false, error: "btc_address_invalid" });
  });
});
