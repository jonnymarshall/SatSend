import { describe, it, expect } from "vitest";
import { matchQuote, quoteSats, QUOTE_VALID_MS, QUOTE_SIGHTING_GRACE_MS, type PaymentQuote } from "./quotes";

const T0 = new Date("2026-10-28T12:00:00Z").getTime();
const at = (min: number) => new Date(T0 + min * 60_000);

function quote(id: string, sats: number, createdMin = 0): PaymentQuote {
  return {
    id,
    amount_sats: sats,
    btc_price: 50_000,
    created_at: at(createdMin).toISOString(),
    expires_at: new Date(at(createdMin).getTime() + QUOTE_VALID_MS).toISOString(),
  };
}

describe("quoteSats", () => {
  it("is the invoice total in whole sats at the price", () => {
    expect(quoteSats(25, 50_000)).toBe(50_000);
    expect(quoteSats(100, 67_123.45)).toBe(148_979);
  });

  it("refuses a price that isn't positive", () => {
    expect(() => quoteSats(25, 0)).toThrow();
  });
});

describe("matchQuote", () => {
  it("a quote lasts 30 minutes, with 30 more for the background check to notice", () => {
    expect(QUOTE_VALID_MS).toBe(30 * 60_000);
    expect(QUOTE_SIGHTING_GRACE_MS).toBe(30 * 60_000);
  });

  it("matches a payment made while the quote was valid", () => {
    expect(matchQuote([quote("a", 50_000)], 50_000, at(10))?.id).toBe("a");
  });

  it("matches up to the end of the grace, not after", () => {
    expect(matchQuote([quote("a", 50_000)], 50_000, at(60))?.id).toBe("a");
    expect(matchQuote([quote("a", 50_000)], 50_000, at(60.1))).toBeNull();
  });

  it("ignores a quote made after the payment", () => {
    expect(matchQuote([quote("a", 50_000, 5)], 50_000, at(4))).toBeNull();
  });

  it("picks the quote closest to the amount paid", () => {
    const quotes = [quote("a", 50_000), quote("b", 51_000, 2), quote("c", 49_000, 4)];
    expect(matchQuote(quotes, 50_900, at(10))?.id).toBe("b");
  });

  it("with no quotes there's no match", () => {
    expect(matchQuote([], 50_000, at(10))).toBeNull();
  });
});
