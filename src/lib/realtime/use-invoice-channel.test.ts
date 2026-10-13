import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useInvoiceChannel } from "./use-invoice-channel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

/*
 * A fake client that behaves like realtime-js 2.103 where it matters
 * (v1.5.10, roadmap v1.5.0.1-H):
 *   - channel(name) returns the still-registered channel for that topic;
 *   - .on() throws once the channel has been subscribed;
 *   - removeChannel() is async: the channel leaves the registry only when the
 *     server acknowledges the unsubscribe (here, when the test resolves it).
 */
type SubscribeCb = (status: string, err?: Error) => void;

interface FakeChannel {
  topic: string;
  subscribed: boolean;
  subscribeCb: SubscribeCb | null;
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

let registry: FakeChannel[] = [];
let created: FakeChannel[] = [];
let pendingRemovals: Array<() => void> = [];
let autoAckRemovals = true;
let setAuthImpl: () => Promise<void> = () => Promise.resolve();

function makeChannel(topic: string): FakeChannel {
  const ch: FakeChannel = {
    topic,
    subscribed: false,
    subscribeCb: null,
    on: vi.fn(() => {
      if (ch.subscribed) {
        throw new Error(`cannot add \`postgres_changes\` callbacks for ${topic} after \`subscribe()\`.`);
      }
      return ch;
    }),
    subscribe: vi.fn((cb: SubscribeCb) => {
      ch.subscribed = true;
      ch.subscribeCb = cb;
      return ch;
    }),
  };
  return ch;
}

const fakeClient = {
  channel: (name: string) => {
    const topic = `realtime:${name}`;
    const existing = registry.find((c) => c.topic === topic);
    if (existing) return existing;
    const ch = makeChannel(topic);
    registry.push(ch);
    created.push(ch);
    return ch;
  },
  getChannels: () => registry,
  removeChannel: vi.fn(
    (ch: FakeChannel) =>
      new Promise<string>((resolve) => {
        const ack = () => {
          registry = registry.filter((c) => c !== ch);
          resolve("ok");
        };
        if (autoAckRemovals) queueMicrotask(ack);
        else pendingRemovals.push(ack);
      })
  ),
  auth: {
    getSession: () => Promise.resolve({ data: { session: { access_token: "tok" } } }),
  },
  realtime: { setAuth: vi.fn(() => setAuthImpl()) },
};

vi.mock("@/lib/supabase/client", () => ({ createClient: () => fakeClient }));

const setup = (ch: RealtimeChannel) =>
  ch.on("postgres_changes" as never, { event: "*", schema: "public", table: "invoices" } as never, () => {});

function mount(name = "invoice:inv-1") {
  return renderHook(() => useInvoiceChannel({ channelName: name, auth: "session", setup }));
}

async function flush(times = 10) {
  await act(async () => {
    for (let i = 0; i < times; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  registry = [];
  created = [];
  pendingRemovals = [];
  autoAckRemovals = true;
  setAuthImpl = () => Promise.resolve();
  fakeClient.removeChannel.mockClear();
  fakeClient.realtime.setAuth.mockClear();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useInvoiceChannel: re-opening a channel (v1.5.10)", () => {
  it("leave and come straight back: waits for the old channel to go, then builds a fresh one", async () => {
    autoAckRemovals = false;
    const first = mount();
    await flush();
    expect(created).toHaveLength(1);
    expect(created[0].subscribed).toBe(true);

    first.unmount(); // removal requested, not yet acknowledged
    mount();
    await flush();
    // Must not reuse the old, subscribed channel (that is what threw).
    expect(created).toHaveLength(1);
    expect(created[0].on).toHaveBeenCalledTimes(1);

    pendingRemovals.forEach((ack) => ack());
    await flush();
    expect(created).toHaveLength(2);
    expect(created[1].subscribed).toBe(true);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("Strict-Mode style mount → unmount → mount does not throw", async () => {
    const first = mount();
    await flush();
    first.unmount();
    mount();
    await flush();
    expect(console.error).not.toHaveBeenCalled();
    expect(registry).toHaveLength(1);
    expect(registry[0].subscribed).toBe(true);
  });

  it("reconnect waits for the dropped channel's removal before re-subscribing", async () => {
    vi.useFakeTimers();
    mount();
    await flush();
    const dropped = created[0];

    autoAckRemovals = false;
    act(() => dropped.subscribeCb!("CHANNEL_ERROR", new Error("socket closed")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(fakeClient.removeChannel).toHaveBeenCalledWith(dropped);
    expect(created).toHaveLength(1); // still waiting on the removal

    pendingRemovals.forEach((ack) => ack());
    await flush();
    expect(created).toHaveLength(2);
    expect(created[1].subscribed).toBe(true);
  });

  it("the replaced channel's CLOSED after a reconnect does not start another reconnect", async () => {
    vi.useFakeTimers();
    mount();
    await flush();
    const dropped = created[0];

    act(() => dropped.subscribeCb!("CHANNEL_ERROR", new Error("socket closed")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    await flush();
    expect(created).toHaveLength(2);

    // realtime-js reports CLOSED on a channel once it has been removed.
    act(() => dropped.subscribeCb!("CLOSED"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await flush();
    expect(created).toHaveLength(2);
    expect(registry).toEqual([created[1]]);
  });

  it("logs the recovery as a warning once the replacement channel subscribes", async () => {
    vi.useFakeTimers();
    mount();
    await flush();
    act(() => created[0].subscribeCb!("SUBSCRIBED"));
    expect(console.warn).not.toHaveBeenCalled();

    act(() => created[0].subscribeCb!("CHANNEL_ERROR", new Error("socket closed")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    await flush();
    act(() => created[1].subscribeCb!("SUBSCRIBED"));
    expect(console.warn).toHaveBeenLastCalledWith("[invoice-realtime] reconnected: invoice:inv-1");
  });

  it("unmounting does not log the channel's own CLOSED as a drop", async () => {
    const view = mount();
    await flush();
    view.unmount();
    act(() => created[0].subscribeCb!("CLOSED"));
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("while the browser is offline it waits instead of burning retries, then reconnects when back online", async () => {
    vi.useFakeTimers();
    let online = true;
    vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
    mount();
    await flush();

    online = false;
    act(() => created[0].subscribeCb!("CHANNEL_ERROR", new Error("offline")));
    // Far longer than the whole backoff (1+2+4+8+16+30s): nothing is retried.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });
    expect(created).toHaveLength(1);
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining("gave up"));
    expect(console.warn).toHaveBeenCalledWith(
      "[invoice-realtime] offline; will reconnect invoice:inv-1 when back online"
    );

    online = true;
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await flush();
    expect(created).toHaveLength(2);
    act(() => created[1].subscribeCb!("SUBSCRIBED"));
    expect(console.warn).toHaveBeenLastCalledWith("[invoice-realtime] reconnected: invoice:inv-1");
  });

  it("an error while connecting schedules a retry instead of an unhandled rejection", async () => {
    vi.useFakeTimers();
    let calls = 0;
    setAuthImpl = () => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error("boom")) : Promise.resolve();
    };
    // anon auth awaits setAuth, so its failure lands inside connect().
    renderHook(() => useInvoiceChannel({ channelName: "invoice:inv-1", auth: "anon", setup }));
    await flush();
    expect(created).toHaveLength(0);
    expect(console.error).toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    await flush();
    expect(created).toHaveLength(1);
    expect(created[0].subscribed).toBe(true);
  });
});
