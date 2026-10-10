import { describe, it, expect, vi, afterEach } from "vitest";

describe("getMempoolBaseUrl / getMempoolWsUrl", () => {
  const originalEnv = process.env.NEXT_PUBLIC_BTC_NETWORK;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_BTC_NETWORK;
    } else {
      process.env.NEXT_PUBLIC_BTC_NETWORK = originalEnv;
    }
    vi.resetModules();
  });

  it("returns mainnet URLs when env var is unset", async () => {
    delete process.env.NEXT_PUBLIC_BTC_NETWORK;
    vi.resetModules();
    const { getMempoolBaseUrl, getMempoolWsUrl } = await import("./btc-network");
    expect(getMempoolBaseUrl()).toBe("https://mempool.space");
    expect(getMempoolWsUrl()).toBe("wss://mempool.space/api/v1/ws");
  });

  it("returns mainnet URLs when env var is 'mainnet'", async () => {
    process.env.NEXT_PUBLIC_BTC_NETWORK = "mainnet";
    vi.resetModules();
    const { getMempoolBaseUrl, getMempoolWsUrl } = await import("./btc-network");
    expect(getMempoolBaseUrl()).toBe("https://mempool.space");
    expect(getMempoolWsUrl()).toBe("wss://mempool.space/api/v1/ws");
  });

  it("returns testnet4 URLs when env var is 'testnet4'", async () => {
    process.env.NEXT_PUBLIC_BTC_NETWORK = "testnet4";
    vi.resetModules();
    const { getMempoolBaseUrl, getMempoolWsUrl } = await import("./btc-network");
    expect(getMempoolBaseUrl()).toBe("https://mempool.space/testnet4");
    expect(getMempoolWsUrl()).toBe("wss://mempool.space/testnet4/api/v1/ws");
  });
});

describe("mempoolTxUrl / mempoolAddressUrl (v1.4.12)", () => {
  const originalEnv = process.env.NEXT_PUBLIC_BTC_NETWORK;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_BTC_NETWORK;
    } else {
      process.env.NEXT_PUBLIC_BTC_NETWORK = originalEnv;
    }
    vi.resetModules();
  });

  it("mempoolTxUrl returns the mainnet tx URL by default", async () => {
    delete process.env.NEXT_PUBLIC_BTC_NETWORK;
    vi.resetModules();
    const { mempoolTxUrl } = await import("./btc-network");
    expect(mempoolTxUrl("abc123")).toBe("https://mempool.space/tx/abc123");
  });

  it("mempoolTxUrl returns the testnet4 tx URL when env var is 'testnet4'", async () => {
    process.env.NEXT_PUBLIC_BTC_NETWORK = "testnet4";
    vi.resetModules();
    const { mempoolTxUrl } = await import("./btc-network");
    expect(mempoolTxUrl("abc123")).toBe("https://mempool.space/testnet4/tx/abc123");
  });

  it("mempoolAddressUrl returns the network-aware address URL", async () => {
    process.env.NEXT_PUBLIC_BTC_NETWORK = "testnet4";
    vi.resetModules();
    const { mempoolAddressUrl } = await import("./btc-network");
    expect(mempoolAddressUrl("bc1qtest")).toBe("https://mempool.space/testnet4/address/bc1qtest");
  });
});

describe("addressNetwork / addressNetworkError (fix/address-freshness-check)", () => {
  const originalEnv = process.env.NEXT_PUBLIC_BTC_NETWORK;
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_BTC_NETWORK;
    else process.env.NEXT_PUBLIC_BTC_NETWORK = originalEnv;
    vi.resetModules();
  });

  async function load(network: string | undefined) {
    if (network === undefined) delete process.env.NEXT_PUBLIC_BTC_NETWORK;
    else process.env.NEXT_PUBLIC_BTC_NETWORK = network;
    vi.resetModules();
    return import("./btc-network");
  }

  const TESTNET = ["tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn", "2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc"];
  const MAINNET = ["bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"];

  it("tells the network from the address prefix", async () => {
    const { addressNetwork } = await load(undefined);
    for (const a of TESTNET) expect(addressNetwork(a), a).toBe("testnet");
    for (const a of MAINNET) expect(addressNetwork(a), a).toBe("mainnet");
    expect(addressNetwork("TB1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KXPJZSX")).toBe("testnet");
  });

  it("on mainnet, rejects testnet addresses and accepts mainnet ones", async () => {
    const { addressNetworkError } = await load("mainnet");
    for (const a of TESTNET) expect(addressNetworkError(a), a).toMatch(/testnet address/i);
    for (const a of MAINNET) expect(addressNetworkError(a), a).toBeNull();
  });

  it("treats an unset network as mainnet, matching getMempoolBaseUrl", async () => {
    const { addressNetworkError } = await load(undefined);
    expect(addressNetworkError(TESTNET[0])).toMatch(/testnet address/i);
  });

  it("on testnet4, rejects mainnet addresses and accepts testnet ones", async () => {
    const { addressNetworkError } = await load("testnet4");
    for (const a of MAINNET) expect(addressNetworkError(a), a).toMatch(/mainnet address/i);
    for (const a of TESTNET) expect(addressNetworkError(a), a).toBeNull();
  });
});
