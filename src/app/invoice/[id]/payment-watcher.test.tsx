import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PaymentWatcher } from "./payment-watcher";

// Mock WebSocket to avoid real connections in tests
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor() {
    setTimeout(() => this.onopen?.(), 0);
  }
}
vi.stubGlobal("WebSocket", MockWebSocket);

// Mock mempool module
const mockFetchAddressTxs = vi.fn();
vi.mock("@/lib/mempool", () => ({
  fetchAddressTxs: (...a: unknown[]) => mockFetchAddressTxs(...a),
  txPaysToAddress: (tx: { vout: { scriptpubkey_address?: string }[] }, addr: string) =>
    tx.vout.some((o) => o.scriptpubkey_address === addr),
}));

// Mock btc-network
vi.mock("@/lib/btc-network", () => ({
  getMempoolWsUrl: () => "wss://mempool.space/testnet4/api/v1/ws",
}));

const unconfirmedTx = {
  txid: "tx1",
  status: { confirmed: false },
  vout: [{ scriptpubkey_address: "tb1qtarget", value: 50000 }],
};
const confirmedTx = { ...unconfirmedTx, status: { confirmed: true, block_height: 100 } };

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchAddressTxs.mockResolvedValue([]);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ status: "payment_detected" }), { status: 200 })
  );
});
afterEach(() => vi.restoreAllMocks());

describe("PaymentWatcher", () => {
  it("renders the status badge from props", () => {
    render(
      <PaymentWatcher
        invoiceId="inv-1"
        btcAddress="tb1qtarget"
        status="pending"
        onStatusChange={() => {}}
      />
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("does not poll when already paid", async () => {
    render(
      <PaymentWatcher
        invoiceId="inv-1"
        btcAddress="tb1qtarget"
        status="paid"
        onStatusChange={() => {}}
      />
    );
    expect(screen.getByText("Paid")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFetchAddressTxs).not.toHaveBeenCalled();
  });

  it("calls onStatusChange with payment_detected AND the detected txid when it finds an unconfirmed tx on mount", async () => {
    const onStatusChange = vi.fn();
    mockFetchAddressTxs.mockResolvedValueOnce([unconfirmedTx]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "payment_detected" }), { status: 200 })
    );

    render(
      <PaymentWatcher
        invoiceId="inv-1"
        btcAddress="tb1qtarget"
        status="pending"
        onStatusChange={onStatusChange}
      />
    );

    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith("payment_detected", "tx1"));
  });

  it("when status is already payment_detected and the active poll finds the same unconfirmed tx, skips the redundant POST (v1.4.13.7)", async () => {
    mockFetchAddressTxs.mockResolvedValue([unconfirmedTx]);

    render(
      <PaymentWatcher
        invoiceId="inv-1"
        btcAddress="tb1qtarget"
        status="payment_detected"
        paymentRevealed={true}
        onStatusChange={vi.fn()}
      />
    );

    // Let the mount-time poll resolve.
    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetchAddressTxs).toHaveBeenCalled();
    // POST should NOT fire — local status already matches what we'd have reported.
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("when status is payment_detected and the active poll finds a CONFIRMED tx, still POSTs (transition to paid is meaningful) (v1.4.13.7)", async () => {
    mockFetchAddressTxs.mockResolvedValue([confirmedTx]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "paid" }), { status: 200 })
    );

    render(
      <PaymentWatcher
        invoiceId="inv-1"
        btcAddress="tb1qtarget"
        status="payment_detected"
        paymentRevealed={true}
        onStatusChange={vi.fn()}
      />
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("calls onStatusChange with paid AND the detected txid when it finds a confirmed tx on mount", async () => {
    const onStatusChange = vi.fn();
    mockFetchAddressTxs.mockResolvedValueOnce([confirmedTx]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "paid" }), { status: 200 })
    );

    render(
      <PaymentWatcher
        invoiceId="inv-1"
        btcAddress="tb1qtarget"
        status="pending"
        onStatusChange={onStatusChange}
      />
    );

    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith("paid", "tx1"));
  });

  it("active poll fires every 5s during phase 1 (first 12 polls, v1.4.13.4)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <PaymentWatcher
          invoiceId="inv-1"
          btcAddress="tb1qtarget"
          status="pending"
          paymentRevealed={true}
          onStatusChange={() => {}}
        />
      );

      // Settle the initial mount-time poll, then count only the active-poll ticks.
      await vi.waitFor(() => expect(mockFetchAddressTxs).toHaveBeenCalled());
      mockFetchAddressTxs.mockClear();

      // 60s of phase-1 cadence = 12 polls at 5s each.
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockFetchAddressTxs).toHaveBeenCalledTimes(12);
    } finally {
      vi.useRealTimers();
    }
  });

  it("active poll cadence drops to 10s during phase 2 (polls 13–18, v1.4.13.4)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <PaymentWatcher
          invoiceId="inv-1"
          btcAddress="tb1qtarget"
          status="pending"
          paymentRevealed={true}
          onStatusChange={() => {}}
        />
      );
      await vi.waitFor(() => expect(mockFetchAddressTxs).toHaveBeenCalled());
      mockFetchAddressTxs.mockClear();

      // Burn through phase 1: 60s → 12 polls.
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockFetchAddressTxs).toHaveBeenCalledTimes(12);

      // Phase 2 begins — next poll should fire at +10s, not +5s.
      await vi.advanceTimersByTimeAsync(5_000);
      expect(mockFetchAddressTxs).toHaveBeenCalledTimes(12); // still no new poll yet
      await vi.advanceTimersByTimeAsync(5_000);
      expect(mockFetchAddressTxs).toHaveBeenCalledTimes(13); // poll 13 fired at 10s into phase 2

      // Phase 2 runs for another 50s = 5 more polls (total 18 by end of phase 2).
      await vi.advanceTimersByTimeAsync(50_000);
      expect(mockFetchAddressTxs).toHaveBeenCalledTimes(18);
    } finally {
      vi.useRealTimers();
    }
  });

  it("active poll caps at 25 polls total over 5 minutes — then stops entirely (v1.4.13.4)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <PaymentWatcher
          invoiceId="inv-1"
          btcAddress="tb1qtarget"
          status="pending"
          paymentRevealed={true}
          onStatusChange={() => {}}
        />
      );
      await vi.waitFor(() => expect(mockFetchAddressTxs).toHaveBeenCalled());
      mockFetchAddressTxs.mockClear();

      // Phases: 12×5s + 6×10s + 4×15s + 2×30s + 1×60s = 25 polls over 300s.
      await vi.advanceTimersByTimeAsync(300_000);
      expect(mockFetchAddressTxs).toHaveBeenCalledTimes(25);

      // Cap reached — no more polls regardless of further elapsed time.
      await vi.advanceTimersByTimeAsync(120_000);
      expect(mockFetchAddressTxs).toHaveBeenCalledTimes(25);
    } finally {
      vi.useRealTimers();
    }
  });

  it("when paymentRevealed is omitted (default false), does NOT fire active polling — WS-only detection (v1.4.13.1)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <PaymentWatcher
          invoiceId="inv-1"
          btcAddress="tb1qtarget"
          status="pending"
          onStatusChange={() => {}}
        />
      );

      await vi.waitFor(() => expect(mockFetchAddressTxs).toHaveBeenCalled());
      mockFetchAddressTxs.mockClear();

      await vi.advanceTimersByTimeAsync(30_000);
      expect(mockFetchAddressTxs).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("active polling pauses when the tab is hidden and resumes when visible (v1.4.13.1)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <PaymentWatcher
          invoiceId="inv-1"
          btcAddress="tb1qtarget"
          status="pending"
          paymentRevealed={true}
          onStatusChange={() => {}}
        />
      );
      await vi.waitFor(() => expect(mockFetchAddressTxs).toHaveBeenCalled());
      mockFetchAddressTxs.mockClear();

      // Hide the tab.
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // 30s of hidden time — no active polling should fire.
      await vi.advanceTimersByTimeAsync(30_000);
      expect(mockFetchAddressTxs).not.toHaveBeenCalled();

      // Tab returns to visible — active polling resumes.
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));

      await vi.advanceTimersByTimeAsync(5_000);
      expect(mockFetchAddressTxs).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
    }
  });

  it("when paymentRevealed=true and WS dies, only the 5s active poll fires — no overlapping fallback polls (v1.4.13.3)", async () => {
    let wsInstance: MockWebSocket | null = null;
    class CapturingWebSocket extends MockWebSocket {
      constructor(...args: ConstructorParameters<typeof MockWebSocket>) {
        super(...args);
        // eslint-disable-next-line @typescript-eslint/no-this-alias -- test capture pattern
        wsInstance = this;
      }
    }
    vi.stubGlobal("WebSocket", CapturingWebSocket);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <PaymentWatcher
          invoiceId="inv-1"
          btcAddress="tb1qtarget"
          status="pending"
          paymentRevealed={true}
          onStatusChange={() => {}}
        />
      );
      await vi.waitFor(() => expect(mockFetchAddressTxs).toHaveBeenCalled());
      mockFetchAddressTxs.mockClear();

      // mempool.space's WS dies — payer is revealed. Pre-v1.4.13.3 this would
      // trigger BOTH the active poll (5s) AND the exp-backoff fallback (2s/4s/8s/16s),
      // producing irregular polling clusters. Post-v1.4.13.3 only the 5s active poll fires.
      expect(wsInstance).not.toBeNull();
      wsInstance!.onclose?.();

      // Advance exactly 30s. Active poll alone should fire 6 times (5s, 10s, 15s, 20s, 25s, 30s).
      // If the fallback is still alive, we'd see additional polls at +2s, +6s, +14s on top.
      await vi.advanceTimersByTimeAsync(30_000);
      expect(mockFetchAddressTxs).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
      vi.stubGlobal("WebSocket", MockWebSocket);
    }
  });

  it("when paymentRevealed=false, WS close does NOT trigger any polling — cron is the safety net for window-shoppers (v1.4.13.2)", async () => {
    let wsInstance: MockWebSocket | null = null;
    class CapturingWebSocket extends MockWebSocket {
      constructor(...args: ConstructorParameters<typeof MockWebSocket>) {
        super(...args);
        // eslint-disable-next-line @typescript-eslint/no-this-alias -- test capture pattern
        wsInstance = this;
      }
    }
    vi.stubGlobal("WebSocket", CapturingWebSocket);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <PaymentWatcher
          invoiceId="inv-1"
          btcAddress="tb1qtarget"
          status="pending"
          // paymentRevealed defaults to false (window-shopper)
          onStatusChange={() => {}}
        />
      );
      await vi.waitFor(() => expect(mockFetchAddressTxs).toHaveBeenCalled());
      mockFetchAddressTxs.mockClear();

      // mempool.space's testnet WS routinely dies after ~60s — simulate that.
      expect(wsInstance).not.toBeNull();
      wsInstance!.onclose?.();

      // 60+ seconds later: NO fallback polls should have fired. We don't burn
      // API spend on visitors who haven't committed to paying.
      await vi.advanceTimersByTimeAsync(70_000);
      expect(mockFetchAddressTxs).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.stubGlobal("WebSocket", MockWebSocket);
    }
  });

  it("reopens the mempool.space WebSocket after it closes, with bounded backoff (v1.4.22-H / M-MONEY-2)", async () => {
    const instances: MockWebSocket[] = [];
    class CapturingWebSocket extends MockWebSocket {
      constructor(...args: ConstructorParameters<typeof MockWebSocket>) {
        super(...args);
        instances.push(this);
      }
    }
    vi.stubGlobal("WebSocket", CapturingWebSocket);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <PaymentWatcher
          invoiceId="inv-1"
          btcAddress="tb1qtarget"
          status="pending"
          onStatusChange={() => {}}
        />
      );
      await vi.waitFor(() => expect(instances.length).toBe(1));

      // The socket drops.
      instances[0].onclose?.();

      // The first reconnect fires after ~1s of backoff.
      await vi.advanceTimersByTimeAsync(1_000);
      expect(instances.length).toBe(2);
    } finally {
      vi.useRealTimers();
      vi.stubGlobal("WebSocket", MockWebSocket);
    }
  });

  // v1.4.13.3: removed two tests that asserted the WS-close exp-backoff
  // fallback (added in v1.4.13, gated in v1.4.13.2). The fallback was vestigial
  // once the v1.4.13.1 active alongside-WS poll subsumed it. Coverage of the
  // visibility-paused / revealed-only behaviour is now provided by the active
  // poll tests above and by the v1.4.13.2 "WS close does NOT trigger any
  // polling" test for window-shoppers.
});
