import { bech32, bech32m } from "bech32";
import bs58check from "bs58check";
import type { Json } from "@/lib/database.types";

const ACCESS_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// v1.4.26-H: minimum length for a user-set access code.
export const MIN_ACCESS_CODE_LENGTH = 6;

export function generateAccessCode(): string {
  return Array.from(
    { length: 8 },
    () => ACCESS_CODE_CHARS[Math.floor(Math.random() * ACCESS_CODE_CHARS.length)]
  ).join("");
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

// One home for the JSONB write cast (v1.4.27-H). line_items is a JSONB column
// whose shape is enforced by the line_items_shape CHECK (migration 0027).
export function lineItemsToJson(items: LineItem[]): Json {
  return items as unknown as Json;
}

export function computeInvoiceTotals(
  items: LineItem[],
  taxPercent: number
): { subtotal: number; taxFiat: number; total: number } {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  const taxFiat = Math.round(subtotal * taxPercent) / 100;
  return { subtotal, taxFiat, total: subtotal + taxFiat };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidBtcAddress(address: string): boolean {
  if (!address) return false;
  const lower = address.toLowerCase();

  if (lower.startsWith("bc1") || lower.startsWith("tb1")) {
    // Segwit v0 — bech32 (bc1q..., tb1q...)
    try {
      const { prefix, words } = bech32.decode(lower);
      if (prefix !== "bc" && prefix !== "tb") return false;
      if (words[0] !== 0) return false;
      const program = bech32.fromWords(words.slice(1));
      return program.length === 20 || program.length === 32;
    } catch {}

    // Segwit v1+ — bech32m (bc1p..., tb1p...)
    try {
      const { prefix, words } = bech32m.decode(lower);
      if (prefix !== "bc" && prefix !== "tb") return false;
      if (words[0] < 1 || words[0] > 16) return false;
      const program = bech32m.fromWords(words.slice(1));
      return program.length >= 2 && program.length <= 40;
    } catch {}

    return false;
  }

  // Legacy — base58check (P2PKH 1..., P2SH 3..., testnet m/n/2...)
  try {
    const decoded = bs58check.decode(address);
    if (decoded.length !== 21) return false;
    const version = decoded[0];
    return ([0x00, 0x05, 0x6f, 0xc4] as number[]).includes(version);
  } catch {}

  return false;
}
