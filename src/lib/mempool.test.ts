import { describe, it, expect, vi, afterEach } from "vitest";
import {
  txPaysToAddress,
  fetchAddressTxs,
  fetchTx,
  fetchTipHeight,
  confirmationDepth,
  addressHasHistory,
} from "./mempool";
import type { MempoolTx } from "./mempool";

const tx = (vout: { scriptpubkey_address?: string; value: number }[]): MempoolTx => ({
  txid: "abc123",
  status: { confirmed: false },
  vout,
});

describe("txPaysToAddress", () => {
  it("returns true when a vout matches the address", () => {
    const t = tx([
      { scriptpubkey_address: "tb1qother", value: 1000 },
      { scriptpubkey_address: "tb1qtarget", value: 5000 },
    ]);
    expect(txPaysToAddress(t, "tb1qtarget")).toBe(true);
  });

  it("returns false when no vout matches", () => {
    const t = tx([{ scriptpubkey_address: "tb1qother", value: 1000 }]);
    expect(txPaysToAddress(t, "tb1qtarget")).toBe(false);
  });

  it("returns false when vout has no address (OP_RETURN etc)", () => {
    const t = tx([{ value: 0 }]);
    expect(txPaysToAddress(t, "tb1qtarget")).toBe(false);
  });
});

const fakeTx: MempoolTx = {
  txid: "abc123",
  status: { confirmed: false },
  vout: [{ scriptpubkey_address: "tb1qtarget", value: 10000 }],
};

describe("fetchAddressTxs", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches from the correct mempool base URL", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([fakeTx]), { status: 200 })
    );
    await fetchAddressTxs("tb1qtarget");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/address/tb1qtarget/txs")
    );
  });

  it("returns empty array on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not found", { status: 404 })
    );
    expect(await fetchAddressTxs("tb1qtarget")).toEqual([]);
  });

  it("returns empty array when fetch throws (network failure)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await fetchAddressTxs("tb1qtarget")).toEqual([]);
  });
});

describe("fetchTx", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches a transaction by txid", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(fakeTx), { status: 200 })
    );
    const result = await fetchTx("abc123");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/api/tx/abc123"));
    expect(result?.txid).toBe("abc123");
  });

  it("returns null on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not found", { status: 404 })
    );
    expect(await fetchTx("abc123")).toBeNull();
  });
});

describe("fetchTipHeight", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches the current chain tip height", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("900010", { status: 200 })
    );
    const result = await fetchTipHeight();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/api/blocks/tip/height"));
    expect(result).toBe(900010);
  });

  it("returns null on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("upstream error", { status: 503 })
    );
    expect(await fetchTipHeight()).toBeNull();
  });

  it("returns null when fetch throws (network failure)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network down"));
    expect(await fetchTipHeight()).toBeNull();
  });
});

describe("confirmationDepth", () => {
  it("returns null when the tx is unconfirmed (no block_height)", () => {
    expect(confirmationDepth(900_010, undefined)).toBeNull();
  });

  it("returns null when the tip height is unavailable", () => {
    expect(confirmationDepth(null, 900_000)).toBeNull();
  });

  it("returns 1 when the tx just landed in the tip block", () => {
    expect(confirmationDepth(900_000, 900_000)).toBe(1);
  });

  it("returns 2 when the tx is one block behind the tip", () => {
    expect(confirmationDepth(900_001, 900_000)).toBe(2);
  });
});

describe("addressHasHistory", () => {
  afterEach(() => vi.restoreAllMocks());

  const stats = (chainTxCount: number, mempoolTxCount: number) => ({
    address: "bc1qtest",
    chain_stats: { tx_count: chainTxCount, funded_txo_count: 0, funded_txo_sum: 0, spent_txo_count: 0, spent_txo_sum: 0 },
    mempool_stats: { tx_count: mempoolTxCount, funded_txo_count: 0, funded_txo_sum: 0, spent_txo_count: 0, spent_txo_sum: 0 },
  });

  it("returns true when the address has any confirmed on-chain transactions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(stats(5, 0)), { status: 200 })
    );
    expect(await addressHasHistory("bc1qtest")).toBe(true);
  });

  it("returns true when the address has any pending mempool transactions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(stats(0, 1)), { status: 200 })
    );
    expect(await addressHasHistory("bc1qtest")).toBe(true);
  });

  it("returns false when the address has no transactions on-chain or in mempool", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(stats(0, 0)), { status: 200 })
    );
    expect(await addressHasHistory("bc1qtest")).toBe(false);
  });

  it("returns null when mempool.space is unreachable (non-OK response)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("upstream error", { status: 503 })
    );
    expect(await addressHasHistory("bc1qtest")).toBeNull();
  });

  it("returns null when fetch throws (network failure)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("network down"));
    expect(await addressHasHistory("bc1qtest")).toBeNull();
  });

  it("queries the network-aware base URL", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(stats(0, 0)), { status: 200 })
    );
    await addressHasHistory("bc1qtest");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/api/address/bc1qtest"));
  });
});
