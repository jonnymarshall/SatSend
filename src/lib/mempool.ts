import { getMempoolBaseUrl } from "./btc-network";

export interface MempoolTxStatus {
  confirmed: boolean;
  block_height?: number;
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

export async function fetchAddressTxs(address: string): Promise<MempoolTx[]> {
  const base = getMempoolBaseUrl();
  const res = await fetch(`${base}/api/address/${address}/txs`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchTx(txid: string): Promise<MempoolTx | null> {
  const base = getMempoolBaseUrl();
  const res = await fetch(`${base}/api/tx/${txid}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchTipHeight(): Promise<number | null> {
  const base = getMempoolBaseUrl();
  try {
    const res = await fetch(`${base}/api/blocks/tip/height`);
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
// whatever the current tip is, so the caller must supply both.
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
