export const BTC_NETWORK = process.env.NEXT_PUBLIC_BTC_NETWORK ?? "mainnet";

export function getMempoolBaseUrl(): string {
  return BTC_NETWORK === "testnet4"
    ? "https://mempool.space/testnet4"
    : "https://mempool.space";
}

export function getMempoolWsUrl(): string {
  return BTC_NETWORK === "testnet4"
    ? "wss://mempool.space/testnet4/api/v1/ws"
    : "wss://mempool.space/api/v1/ws";
}

export function mempoolTxUrl(txid: string): string {
  return `${getMempoolBaseUrl()}/tx/${txid}`;
}

export function mempoolAddressUrl(address: string): string {
  return `${getMempoolBaseUrl()}/address/${address}`;
}

export type AddressNetwork = "mainnet" | "testnet";

/**
 * Which bitcoin network an address belongs to, read from its prefix. Assumes the
 * format was already checked (isValidBtcAddress): bc1 / 1 / 3 are mainnet,
 * tb1 / m / n / 2 are testnet (testnet3 and testnet4 share prefixes).
 */
export function addressNetwork(address: string): AddressNetwork | null {
  const a = address.trim();
  const lower = a.toLowerCase();
  if (lower.startsWith("bc1")) return "mainnet";
  if (lower.startsWith("tb1")) return "testnet";
  if (/^[13]/.test(a)) return "mainnet";
  if (/^[mn2]/.test(a)) return "testnet";
  return null;
}

/**
 * A user-facing error when the address is for the other network than the one
 * SatSend runs on, else null. Same rule as getMempoolBaseUrl: anything other than
 * "testnet4" is mainnet. Without this, mempool.space answers the lookup with HTTP
 * 400 and the freshness check reports a misleading "network check failed".
 */
export function addressNetworkError(address: string): string | null {
  const running: AddressNetwork = BTC_NETWORK === "testnet4" ? "testnet" : "mainnet";
  const given = addressNetwork(address);
  if (!given || given === running) return null;
  return given === "testnet"
    ? "This is a testnet address, but SatSend is running on mainnet (real bitcoin). Use a mainnet address (bc1…, 1… or 3…)."
    : "This is a mainnet address, but SatSend is running on testnet. Use a testnet address (tb1…).";
}
