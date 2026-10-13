import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

import { useCheckWaitingPayments, CHECK_INTERVAL_MS } from "./use-check-waiting-payments";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ checked: 1, transitioned: 0 }) });
  vi.stubGlobal("fetch", mockFetch);
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useCheckWaitingPayments", () => {
  it("checks soon after opening, then about once a minute", async () => {
    renderHook(() => useCheckWaitingPayments(true));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/invoices/check-payments", { method: "POST" });
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does nothing when no invoice is waiting", async () => {
    renderHook(() => useCheckWaitingPayments(false));
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("pauses while the tab is hidden", async () => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    renderHook(() => useCheckWaitingPayments(true));
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("refreshes the list when a status changed", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ checked: 1, transitioned: 1 }) });
    renderHook(() => useCheckWaitingPayments(true));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("stops when the page closes", async () => {
    const { unmount } = renderHook(() => useCheckWaitingPayments(true));
    unmount();
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
