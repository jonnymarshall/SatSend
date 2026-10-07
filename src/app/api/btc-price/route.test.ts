import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockFetchBtcPrice = vi.fn();
vi.mock("@/lib/btc-price", () => ({
  fetchBtcPrice: (...args: unknown[]) => mockFetchBtcPrice(...args),
}));

async function get(currency?: string) {
  const { GET } = await import("./route");
  const url = currency
    ? `http://localhost/api/btc-price?currency=${currency}`
    : "http://localhost/api/btc-price";
  return GET(new NextRequest(url));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchBtcPrice.mockResolvedValue({ price: 100000, source: "coinbase" });
});

describe("GET /api/btc-price", () => {
  it("returns the price for USD", async () => {
    const res = await get("USD");
    expect(res.status).toBe(200);
    expect(mockFetchBtcPrice).toHaveBeenCalledWith("USD");
  });

  it("defaults to USD when no currency is given", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(mockFetchBtcPrice).toHaveBeenCalledWith("USD");
  });

  it("is case-insensitive for the allowlist", async () => {
    const res = await get("usd");
    expect(res.status).toBe(200);
    expect(mockFetchBtcPrice).toHaveBeenCalledWith("USD");
  });

  it("rejects a non-USD currency with 400 and never calls the price source (v1.4.25-H)", async () => {
    const res = await get("EUR");
    expect(res.status).toBe(400);
    expect(mockFetchBtcPrice).not.toHaveBeenCalled();
  });
});
