import { describe, it, expect } from "vitest";
import { PRO_PRICE, BITCOIN_DISCOUNT, bitcoinPrice, usd } from "./pro-price";

// R-65 (Jonny, 2026-11-27): Pro is $15 a month or $150 a year (2 months free),
// and 10% less paid in bitcoin.
describe("Pro price", () => {
  it("is $15 a month or $150 a year", () => {
    expect(PRO_PRICE).toEqual({ monthly: 15, yearly: 150 });
  });

  it("is 10% off in bitcoin: $13.50 a month, $135 a year", () => {
    expect(BITCOIN_DISCOUNT).toBe(0.1);
    expect(bitcoinPrice(PRO_PRICE.monthly)).toBe(13.5);
    expect(bitcoinPrice(PRO_PRICE.yearly)).toBe(135);
  });

  it("prints whole dollars bare and the rest with cents", () => {
    expect(usd(15)).toBe("$15");
    expect(usd(135)).toBe("$135");
    expect(usd(13.5)).toBe("$13.50");
    expect(usd(12.5)).toBe("$12.50");
  });
});
