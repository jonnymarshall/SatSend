import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useInvoiceRealtime, useSingleInvoiceRealtime } from "./use-invoice-realtime";

const refreshSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshSpy }),
}));

type Callback = (payload: unknown) => void;

interface MockChannel {
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

let capturedCallback: Callback | null = null;
let lastChannelName: string | null = null;
let lastOnArgs: unknown[] | null = null;
const channelSpy = vi.fn();
const removeChannelSpy = vi.fn();
const setAuthSpy = vi.fn();

function makeMockChannel(): MockChannel {
  const channel: MockChannel = {
    on: vi.fn((...args: unknown[]) => {
      lastOnArgs = args;
      capturedCallback = args[args.length - 1] as Callback;
      return channel;
    }),
    subscribe: vi.fn(() => channel),
  };
  return channel;
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: (name: string) => {
      channelSpy(name);
      lastChannelName = name;
      return makeMockChannel();
    },
    removeChannel: (ch: unknown) => removeChannelSpy(ch),
    // No channel left over from an earlier mount (v1.5.10).
    getChannels: () => [],
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { access_token: "tok", user: { id: "u1" } } } }),
    },
    realtime: {
      setAuth: setAuthSpy,
      isDisconnecting: () => false,
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
  lastChannelName = null;
  lastOnArgs = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useInvoiceRealtime", () => {
  it("opens a channel subscribed to postgres_changes on public.invoices (no explicit filter — relies on RLS)", async () => {
    renderHook(() => useInvoiceRealtime("user-123"));
    await flushAsync();

    expect(channelSpy).toHaveBeenCalledOnce();
    expect(lastChannelName).toContain("user-123");

    expect(lastOnArgs).not.toBeNull();
    const [eventName, config] = lastOnArgs as [string, Record<string, string | undefined>];
    expect(eventName).toBe("postgres_changes");
    expect(config.event).toBe("*");
    expect(config.schema).toBe("public");
    expect(config.table).toBe("invoices");
    expect(config.filter).toBeUndefined();
  });

  it("explicitly sets the Realtime auth before subscribing", async () => {
    renderHook(() => useInvoiceRealtime("user-123"));
    await flushAsync();
    expect(setAuthSpy).toHaveBeenCalledWith("tok");
  });

  it("calls router.refresh when a postgres_changes event fires", async () => {
    renderHook(() => useInvoiceRealtime("user-123"));
    await flushAsync();

    expect(refreshSpy).not.toHaveBeenCalled();

    capturedCallback?.({ eventType: "UPDATE", new: { id: "inv-1", status: "payment_detected" } });
    expect(refreshSpy).toHaveBeenCalledOnce();

    capturedCallback?.({ eventType: "INSERT", new: { id: "inv-2" } });
    expect(refreshSpy).toHaveBeenCalledTimes(2);

    capturedCallback?.({ eventType: "DELETE", old: { id: "inv-3" } });
    expect(refreshSpy).toHaveBeenCalledTimes(3);
  });

  it("removes the channel on unmount", async () => {
    const { unmount } = renderHook(() => useInvoiceRealtime("user-123"));
    await flushAsync();
    expect(removeChannelSpy).not.toHaveBeenCalled();

    unmount();

    expect(removeChannelSpy).toHaveBeenCalledOnce();
  });

  it("no-ops when userId is empty", async () => {
    renderHook(() => useInvoiceRealtime(""));
    await flushAsync();
    expect(channelSpy).not.toHaveBeenCalled();
    expect(removeChannelSpy).not.toHaveBeenCalled();
  });
});

describe("useSingleInvoiceRealtime", () => {
  it("opens a channel filtered by invoice id", async () => {
    renderHook(() => useSingleInvoiceRealtime("inv-abc"));
    await flushAsync();

    expect(channelSpy).toHaveBeenCalledOnce();
    expect(lastChannelName).toContain("inv-abc");

    expect(lastOnArgs).not.toBeNull();
    const [eventName, config] = lastOnArgs as [string, Record<string, string>];
    expect(eventName).toBe("postgres_changes");
    expect(config.table).toBe("invoices");
    expect(config.filter).toBe("id=eq.inv-abc");
  });

  it("calls router.refresh when an event fires", async () => {
    renderHook(() => useSingleInvoiceRealtime("inv-abc"));
    await flushAsync();
    expect(refreshSpy).not.toHaveBeenCalled();

    capturedCallback?.({ eventType: "UPDATE", new: { id: "inv-abc", status: "payment_detected" } });
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it("removes the channel on unmount", async () => {
    const { unmount } = renderHook(() => useSingleInvoiceRealtime("inv-abc"));
    await flushAsync();
    expect(removeChannelSpy).not.toHaveBeenCalled();
    unmount();
    expect(removeChannelSpy).toHaveBeenCalledOnce();
  });

  it("no-ops when invoiceId is empty", async () => {
    renderHook(() => useSingleInvoiceRealtime(""));
    await flushAsync();
    expect(channelSpy).not.toHaveBeenCalled();
    expect(removeChannelSpy).not.toHaveBeenCalled();
  });
});
