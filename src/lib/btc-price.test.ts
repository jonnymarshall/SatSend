import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchBtcPrice, fetchJudgingPrices, clearPriceCache } from "./btc-price";

beforeEach(() => {
  vi.unstubAllGlobals();
  clearPriceCache();
});

function makeFetch(responses: Array<{ ok: boolean; body?: unknown }>) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++] ?? { ok: false };
    return { ok: r.ok, json: async () => r.body ?? {} };
  });
}

describe("fetchBtcPrice", () => {
  it("returns price from Coinbase on success", async () => {
    vi.stubGlobal("fetch", makeFetch([{ ok: true, body: { data: { amount: "95000.50" } } }]));
    const result = await fetchBtcPrice("USD");
    expect(result.price).toBe(95000.5);
    expect(result.source).toBe("coinbase");
  });

  it("falls back to CoinGecko when Coinbase fails", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch([{ ok: false }, { ok: true, body: { bitcoin: { usd: 94500 } } }])
    );
    const result = await fetchBtcPrice("USD");
    expect(result.price).toBe(94500);
    expect(result.source).toBe("coingecko");
  });

  it("throws when both APIs fail", async () => {
    vi.stubGlobal("fetch", makeFetch([{ ok: false }, { ok: false }]));
    await expect(fetchBtcPrice("USD")).rejects.toThrow();
  });

  it("returns cached result within TTL without re-fetching", async () => {
    const fetchMock = makeFetch([{ ok: true, body: { data: { amount: "95000" } } }]);
    vi.stubGlobal("fetch", fetchMock);
    await fetchBtcPrice("USD");
    await fetchBtcPrice("USD");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches separately per currency", async () => {
    const fetchMock = makeFetch([
      { ok: true, body: { data: { amount: "95000" } } },
      { ok: true, body: { data: { amount: "87000" } } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    await fetchBtcPrice("USD");
    await fetchBtcPrice("EUR");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("fetchJudgingPrices (R-44)", () => {
  it("for USD: the price, and a dollar rate of 1, with one lookup", async () => {
    const fetchMock = makeFetch([{ ok: true, body: { data: { amount: "60000" } } }]);
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchJudgingPrices("USD")).toEqual({ btcPrice: 60000, usdRate: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("for EUR: the euro price, and the dollar rate from the two bitcoin prices", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch([
        { ok: true, body: { data: { amount: "55000" } } },
        { ok: true, body: { data: { amount: "60000" } } },
      ])
    );
    const r = await fetchJudgingPrices("EUR");
    expect(r.btcPrice).toBe(55000);
    expect(r.usdRate).toBeCloseTo(55000 / 60000, 10);
  });

  it("a missing dollar price leaves the rate null (the verdict waits), but keeps the price", async () => {
    vi.stubGlobal("fetch", makeFetch([{ ok: true, body: { data: { amount: "55000" } } }, { ok: false }, { ok: false }]));
    expect(await fetchJudgingPrices("EUR")).toEqual({ btcPrice: 55000, usdRate: null });
  });

  it("a missing invoice-currency price leaves both null", async () => {
    vi.stubGlobal("fetch", makeFetch([{ ok: false }, { ok: false }]));
    expect(await fetchJudgingPrices("EUR")).toEqual({ btcPrice: null, usdRate: null });
  });
});
