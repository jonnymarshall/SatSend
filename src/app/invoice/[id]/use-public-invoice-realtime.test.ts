import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePublicInvoiceRealtime } from "./use-public-invoice-realtime";

const refreshSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshSpy }),
}));

type Callback = (payload: unknown) => void;
type SubscribeCallback = (status: string, err?: unknown) => void;

interface MockChannel {
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

let capturedCallback: Callback | null = null;
let capturedSubscribeCallback: SubscribeCallback | null = null;
let lastChannelName: string | null = null;
let lastChannelConfig: unknown = null;
let lastOnArgs: unknown[] | null = null;
const channelSpy = vi.fn();
const removeChannelSpy = vi.fn();
const setAuthSpy = vi.fn().mockResolvedValue(undefined);

function makeMockChannel(): MockChannel {
  const channel: MockChannel = {
    on: vi.fn((...args: unknown[]) => {
      lastOnArgs = args;
      capturedCallback = args[args.length - 1] as Callback;
      return channel;
    }),
    subscribe: vi.fn((cb?: SubscribeCallback) => {
      capturedSubscribeCallback = cb ?? null;
      return channel;
    }),
  };
  return channel;
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: (name: string, config?: unknown) => {
      channelSpy(name, config);
      lastChannelName = name;
      lastChannelConfig = config;
      return makeMockChannel();
    },
    removeChannel: (ch: unknown) => removeChannelSpy(ch),
    realtime: {
      setAuth: setAuthSpy,
    },
  }),
}));

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  refreshSpy.mockClear();
  channelSpy.mockClear();
  removeChannelSpy.mockClear();
  setAuthSpy.mockClear();
  capturedCallback = null;
  capturedSubscribeCallback = null;
  lastChannelName = null;
  lastChannelConfig = null;
  lastOnArgs = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePublicInvoiceRealtime", () => {
  it("opens a private broadcast channel named after the invoice id", async () => {
    renderHook(() => usePublicInvoiceRealtime("inv-abc", () => {}));
    await flushAsync();

    expect(channelSpy).toHaveBeenCalledOnce();
    expect(lastChannelName).toBe("invoice:inv-abc");
    expect(lastChannelConfig).toEqual({ config: { private: true } });
  });

  it("calls realtime.setAuth() before subscribing — required for private broadcast channels, even for anon", async () => {
    renderHook(() => usePublicInvoiceRealtime("inv-abc", () => {}));
    await flushAsync();

    expect(setAuthSpy).toHaveBeenCalledOnce();
    expect(setAuthSpy).toHaveBeenCalledWith();
  });

  it("subscribes to the broadcast UPDATE event", async () => {
    renderHook(() => usePublicInvoiceRealtime("inv-abc", () => {}));
    await flushAsync();

    expect(lastOnArgs).not.toBeNull();
    const [eventName, config] = lastOnArgs as [string, Record<string, string>];
    expect(eventName).toBe("broadcast");
    expect(config.event).toBe("UPDATE");
  });

  it("invokes onUpdate with status/btc_txid from payload.payload.record", async () => {
    const onUpdate = vi.fn();
    renderHook(() => usePublicInvoiceRealtime("inv-abc", onUpdate));
    await flushAsync();

    expect(onUpdate).not.toHaveBeenCalled();

    capturedCallback?.({
      event: "UPDATE",
      type: "broadcast",
      payload: {
        operation: "UPDATE",
        table: "invoices",
        schema: "public",
        record: { id: "inv-abc", status: "payment_detected", btc_txid: "abc123" },
        old_record: { id: "inv-abc", status: "pending", btc_txid: null },
      },
    });

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledWith({ status: "payment_detected", btc_txid: "abc123" });
  });

  it("logs on successful subscription, not just on error — silence made a real CHANNEL_ERROR indistinguishable from success during debugging", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    renderHook(() => usePublicInvoiceRealtime("inv-abc", () => {}));
    await flushAsync();

    capturedSubscribeCallback?.("SUBSCRIBED");

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("subscribed"));
  });

  it("logs when a broadcast message is received, before parsing it", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    renderHook(() => usePublicInvoiceRealtime("inv-abc", () => {}));
    await flushAsync();

    capturedCallback?.({
      event: "UPDATE",
      type: "broadcast",
      payload: { record: { id: "inv-abc", status: "paid", btc_txid: "abc" } },
    });

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("broadcast received"), expect.anything());
  });

  it("removes the channel on unmount", async () => {
    const { unmount } = renderHook(() => usePublicInvoiceRealtime("inv-abc", () => {}));
    await flushAsync();
    expect(removeChannelSpy).not.toHaveBeenCalled();

    unmount();

    expect(removeChannelSpy).toHaveBeenCalledOnce();
  });

  it("no-ops when invoiceId is empty", async () => {
    renderHook(() => usePublicInvoiceRealtime("", () => {}));
    await flushAsync();
    expect(channelSpy).not.toHaveBeenCalled();
    expect(removeChannelSpy).not.toHaveBeenCalled();
  });

  it("calls router.refresh when the document becomes visible", async () => {
    renderHook(() => usePublicInvoiceRealtime("inv-abc", () => {}));
    await flushAsync();

    expect(refreshSpy).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it("does not call router.refresh when the document becomes hidden", async () => {
    renderHook(() => usePublicInvoiceRealtime("inv-abc", () => {}));
    await flushAsync();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
