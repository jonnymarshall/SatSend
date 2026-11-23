/*
 * Locked quotes (v1.5.29, roadmap v1.5.2.22-H). When the client clicks "Pay now
 * in Bitcoin", the server records the bitcoin amount it shows and the price
 * behind it (table invoice_quotes). A payment that matches a quote is judged in
 * bitcoin against it, so the price moving between paying and confirming no
 * longer counts against anyone.
 */

/** How long the amount shown is held; the page asks for a new quote after it. */
export const QUOTE_VALID_MS = 30 * 60_000;

/**
 * How long after a quote expires a payment can still match it. SatSend may only
 * notice a payment up to 30 minutes after it's sent (the background check's
 * slowest interval), so the sighting can lag the payment by that much.
 */
export const QUOTE_SIGHTING_GRACE_MS = 30 * 60_000;

/** A quote made in the last minute is handed out again rather than a new one made. */
export const QUOTE_REUSE_MS = 60_000;

/** Quotes that expired this long ago and judged no payment are deleted. */
export const QUOTE_KEEP_MS = 24 * 60 * 60_000;

export interface PaymentQuote {
  id: string;
  amount_sats: number;
  btc_price: number;
  created_at: string;
  expires_at: string;
}

/** The invoice total in whole sats at a price. */
export function quoteSats(totalFiat: number, btcPrice: number): number {
  if (!(btcPrice > 0)) throw new Error("BTC price must be positive");
  return Math.round((totalFiat / btcPrice) * 1e8);
}

/**
 * The quote a payment was made against: one made before the payment and still
 * valid then (plus the sighting grace), closest in amount to what was paid.
 */
export function matchQuote(
  quotes: readonly PaymentQuote[],
  receivedSats: number,
  paidAt: Date,
): PaymentQuote | null {
  const t = paidAt.getTime();
  const covering = quotes.filter(
    (q) => Date.parse(q.created_at) <= t && t <= Date.parse(q.expires_at) + QUOTE_SIGHTING_GRACE_MS,
  );
  if (covering.length === 0) return null;
  return covering.reduce((best, q) =>
    Math.abs(q.amount_sats - receivedSats) < Math.abs(best.amount_sats - receivedSats) ? q : best,
  );
}
