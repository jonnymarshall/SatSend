import { existsSync } from "node:fs";
import { join } from "node:path";
import { Suspense, isValidElement, type ReactElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// v1.5.30 (roadmap v1.5.2.23-H): an unknown invoice link answers HTTP 404.
// Once a page starts streaming (a route-level loading.tsx, or a component
// suspending under a Suspense boundary) the 200 status has already been sent,
// and notFound() can only show the not-found page, not change the status. So
// the page must decide "not found" before anything streams, and keep the
// spinner for the slow part only (the bitcoin price).

const mockFetchPublicInvoice = vi.fn();
const mockFetchBtcPrice = vi.fn();
vi.mock("@/lib/invoice-public", () => ({
  fetchPublicInvoice: (...a: unknown[]) => mockFetchPublicInvoice(...a),
  toPublicInvoice: (i: Record<string, unknown>) => i,
}));
vi.mock("@/lib/btc-price", () => ({ fetchBtcPrice: (...a: unknown[]) => mockFetchBtcPrice(...a) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import ClientInvoicePage from "./page";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const INVOICE = { id: "inv-1", access_code: null, btc_address: "bc1qexample", currency: "USD" };

beforeEach(() => {
  mockFetchPublicInvoice.mockReset();
  mockFetchBtcPrice.mockReset();
});

describe("client invoice page: unknown links answer 404", () => {
  it("has no route-level loading.tsx (it would stream the response and force a 200)", () => {
    expect(existsSync(join(__dirname, "loading.tsx"))).toBe(false);
  });

  it("an unknown invoice is not found before anything is rendered or the price is asked for", async () => {
    mockFetchPublicInvoice.mockResolvedValue(null);
    await expect(ClientInvoicePage(params("00000000-0000-0000-0000-000000000000"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockFetchBtcPrice).not.toHaveBeenCalled();
  });

  it("a real invoice returns at once, with only the price lookup behind the spinner", async () => {
    mockFetchPublicInvoice.mockResolvedValue(INVOICE);
    // A price that never arrives must not hold up the page's response.
    mockFetchBtcPrice.mockImplementation(() => new Promise(() => {}));
    const page = (await ClientInvoicePage(params("inv-1"))) as ReactElement<{ fallback: ReactElement }>;
    expect(isValidElement(page)).toBe(true);
    expect(page.type).toBe(Suspense);
    expect(isValidElement(page.props.fallback)).toBe(true);
  });

  it("a protected invoice without the access code shows the code screen, not the spinner", async () => {
    mockFetchPublicInvoice.mockResolvedValue({ ...INVOICE, access_code: "SECRET1" });
    const page = (await ClientInvoicePage(params("inv-1"))) as ReactElement;
    expect(page.type).not.toBe(Suspense);
    expect(mockFetchBtcPrice).not.toHaveBeenCalled();
  });
});
