import { getMempoolBaseUrl } from "./btc-network";

export interface MempoolTxStatus {
  confirmed: boolean;
  block_height?: number;
  /** Unix seconds of the block the tx confirmed in (v1.5.27). */
  block_time?: number;
}

export interface MempoolVout {
  scriptpubkey_address?: string;
  value: number;
}

export interface MempoolTx {
  txid: string;
  status: MempoolTxStatus;
  vout: MempoolVout[];
}

export function txPaysToAddress(tx: MempoolTx, address: string): boolean {
  return tx.vout.some((o) => o.scriptpubkey_address === address);
}

// Returns `null` when mempool.space could not be reached (network failure,
// timeout, or a non-OK response) — distinct from `[]`, which means "reached the
// API, this address has no transactions". Callers must not treat an outage as
// "nothing paid yet": doing so burns the invoice's polling schedule during an
// outage and can prematurely stop watching it. (v1.4.22-H / M-MONEY-2)
/** Every mempool.space call gives up after this, so one hung request can't stall a sweep (v1.5.13). */
const MEMPOOL_TIMEOUT_MS = 10_000;

export async function fetchAddressTxs(address: string): Promise<MempoolTx[] | null> {
  const base = getMempoolBaseUrl();
  try {
    const res = await fetch(`${base}/api/address/${address}/txs`, {
      signal: AbortSignal.timeout(MEMPOOL_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchTx(txid: string): Promise<MempoolTx | null> {
  const base = getMempoolBaseUrl();
  try {
    const res = await fetch(`${base}/api/tx/${txid}`, { signal: AbortSignal.timeout(MEMPOOL_TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchTipHeight(): Promise<number | null> {
  const base = getMempoolBaseUrl();
  try {
    const res = await fetch(`${base}/api/blocks/tip/height`, { signal: AbortSignal.timeout(MEMPOOL_TIMEOUT_MS) });
    if (!res.ok) return null;
    const text = await res.text();
    const height = parseInt(text, 10);
    return isFinite(height) ? height : null;
  } catch {
    return null;
  }
}

// Esplora-style APIs (mempool.space included) only expose a tx's block
// height, not a ready-made "confirmations" count — depth is relative to
// whatever the current tip is, so the caller must supply both. The "how deep is
// final" rule, and the 1-confirmation reorg rationale, live in
// payment-schedule.ts → CONFIRMATION_DEPTH_REQUIRED.
export function confirmationDepth(
  tipHeight: number | null,
  blockHeight: number | undefined
): number | null {
  if (tipHeight === null || blockHeight === undefined) return null;
  return tipHeight - blockHeight + 1;
}

interface AddressStatsResponse {
  chain_stats: { tx_count: number };
  mempool_stats: { tx_count: number };
}

export async function addressHasHistory(address: string): Promise<boolean | null> {
  const base = getMempoolBaseUrl();
  try {
    const res = await fetch(`${base}/api/address/${address}`);
    if (!res.ok) return null;
    const data = (await res.json()) as AddressStatsResponse;
    return data.chain_stats.tx_count > 0 || data.mempool_stats.tx_count > 0;
  } catch {
    return null;
  }
}
