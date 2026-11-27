/*
 * The Pro price, in one place (R-65, Jonny 2026-11-27): $15 a month, or $150 a
 * year (2 months free), and 10% less paid in bitcoin ($13.50 / $135). Read by
 * the pricing cards, the FAQ and the /pricing description; billing (R-53,
 * R-46) charges from here too.
 */

export const PRO_PRICE = { monthly: 15, yearly: 150 } as const;

/** Paying for Pro in bitcoin takes this much off. */
export const BITCOIN_DISCOUNT = 0.1;

/** A card price with the bitcoin discount taken off, to the cent. */
export function bitcoinPrice(cardPrice: number): number {
  return Math.round(cardPrice * (1 - BITCOIN_DISCOUNT) * 100) / 100;
}

/** "$15", "$135", "$13.50": whole dollars bare, anything else with cents. */
export function usd(n: number): string {
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}
