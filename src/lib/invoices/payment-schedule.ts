import { txPaysToAddress, confirmationDepth, type MempoolTx } from "@/lib/mempool";

// Index 0 is the publish → first-cron-check delay (referenced by publishStatePatch).
// Indices 1+ are subsequent retry intervals consumed by decidePaymentSchedule via
// `nextAttempt = stage_attempt + 1` while no paying tx has been seen.
//
// v1.4.13.5: schedule tightened from [15s, 5min, 10min, 30min] to fill the
// post-first-miss gap. Real-world testing showed mempool.space's testnet
// indexer often takes 60–120s to surface a broadcast tx, which is *just*
// after the t=60s first cron tick — so the v1.4.13 schedule meant we waited
// 5 minutes for the next attempt. New schedule does 4–5 polls in the first
// 5 minutes (versus 2 polls), at the cost of ~2 extra mempool.space requests
// per pending invoice in that window.
export const PRE_MEMPOOL_DELAYS_MS: readonly number[] = [
  15_000,        // [0] publish → first cron check
  30_000,        // [1] first miss → retry in 30s
  60_000,        // [2] second miss → retry in 60s
  2 * 60_000,    // [3] third miss → retry in 2min
  5 * 60_000,    // [4] fourth miss → retry in 5min
  10 * 60_000,   // [5] fifth miss → retry in 10min
  30 * 60_000,   // [6] sixth miss → retry in 30min, then stop
];

export const POST_MEMPOOL_STAGES: ReadonlyArray<{ count: number; intervalMs: number }> = [
  { count: 3, intervalMs: 10 * 60_000 },
  { count: 6, intervalMs: 60 * 60_000 },
  { count: 12, intervalMs: 4 * 60 * 60_000 },
  { count: 24, intervalMs: 8 * 60 * 60_000 },
];

// Coverage is judged in fiat, priced at the moment the payment is confirmed —
// never at publish time. A price fixed at publish would drift against the
// invoice's actual fiat total as BTC moves, making "did they pay enough" wrong
// by however much the price changed. See v1.4.19-H (S2) planning discussion.
const UNDERPAID_COVERAGE = 0.95;
const OVERPAID_COVERAGE = 1.05;

// mempool.space (and esplora-style APIs generally) only report whether a tx
// is confirmed and which block it landed in — not a live confirmation count,
// since that's relative to the ever-advancing tip. We require the tip to be
// at least this many blocks past the tx's block before treating the payment
// as final, to absorb short reorgs.
export const CONFIRMATION_DEPTH_REQUIRED = 2;

export interface ScheduleInput {
  status: "pending" | "payment_detected";
  btc_address: string;
  mempool_seen_at: string | null;
  stage_attempt: number;
  total_fiat: number;
}

// The caller fetches these (live BTC price, current chain tip) and passes
// them in so this function stays pure and testable. Either being null means
// the oracle/tip is unavailable right now — the payment is left unfinalized
// rather than guessed at.
export interface PriceContext {
  btcPrice: number | null;
  tipHeight: number | null;
}

export interface ScheduleDecision {
  newStatus: "pending" | "payment_detected" | "paid" | "underpaid";
  newMempoolSeenAt: string | null;
  newStageAttempt: number;
  newNextCheckAt: string | null;
  detectedTxid: string | null;
  amountReceivedSats: number | null;
  btcPriceAtDetection: number | null;
  amountReceivedFiat: number | null;
  overpaid: boolean;
}

const NO_VERDICT = {
  amountReceivedSats: null,
  btcPriceAtDetection: null,
  amountReceivedFiat: null,
  overpaid: false,
} as const;

function sumVouts(tx: MempoolTx, address: string): number {
  return tx.vout
    .filter((o) => o.scriptpubkey_address === address)
    .reduce((sum, o) => sum + o.value, 0);
}

function postMempoolIntervalForAttempt(attempt: number): number | null {
  let cumulative = 0;
  for (const stage of POST_MEMPOOL_STAGES) {
    cumulative += stage.count;
    if (attempt < cumulative) return stage.intervalMs;
  }
  return null;
}

function addIso(now: Date, ms: number): string {
  return new Date(now.getTime() + ms).toISOString();
}

export function decidePaymentSchedule(
  input: ScheduleInput,
  txs: MempoolTx[],
  now: Date,
  price: PriceContext
): ScheduleDecision {
  const paying = txs.find((tx) => txPaysToAddress(tx, input.btc_address));

  if (paying) {
    const depth = confirmationDepth(price.tipHeight, paying.status.block_height);
    const finalized =
      paying.status.confirmed &&
      depth !== null &&
      depth >= CONFIRMATION_DEPTH_REQUIRED &&
      price.btcPrice !== null;

    if (finalized) {
      const receivedSats = sumVouts(paying, input.btc_address);
      const receivedFiat = (receivedSats * price.btcPrice!) / 1e8;
      const coverage = receivedFiat / input.total_fiat;
      return {
        newStatus: coverage < UNDERPAID_COVERAGE ? "underpaid" : "paid",
        newMempoolSeenAt: input.mempool_seen_at ?? now.toISOString(),
        newStageAttempt: input.stage_attempt,
        newNextCheckAt: null,
        detectedTxid: paying.txid,
        amountReceivedSats: receivedSats,
        btcPriceAtDetection: price.btcPrice,
        amountReceivedFiat: receivedFiat,
        overpaid: coverage > OVERPAID_COVERAGE,
      };
    }

    // Seen (confirmed-but-shallow, or unconfirmed) but not yet finalized.
    if (input.mempool_seen_at === null) {
      return {
        newStatus: "payment_detected",
        newMempoolSeenAt: now.toISOString(),
        newStageAttempt: 0,
        newNextCheckAt: addIso(now, POST_MEMPOOL_STAGES[0].intervalMs),
        detectedTxid: paying.txid,
        ...NO_VERDICT,
      };
    }

    const nextAttempt = input.stage_attempt + 1;
    const interval = postMempoolIntervalForAttempt(nextAttempt);
    return {
      newStatus: "payment_detected",
      newMempoolSeenAt: input.mempool_seen_at,
      newStageAttempt: nextAttempt,
      newNextCheckAt: interval === null ? null : addIso(now, interval),
      detectedTxid: null,
      ...NO_VERDICT,
    };
  }

  const nextAttempt = input.stage_attempt + 1;

  if (input.mempool_seen_at === null) {
    const interval = PRE_MEMPOOL_DELAYS_MS[nextAttempt];
    return {
      newStatus: "pending",
      newMempoolSeenAt: null,
      newStageAttempt: nextAttempt,
      newNextCheckAt: interval === undefined ? null : addIso(now, interval),
      detectedTxid: null,
      ...NO_VERDICT,
    };
  }

  const interval = postMempoolIntervalForAttempt(nextAttempt);
  return {
    newStatus: "payment_detected",
    newMempoolSeenAt: input.mempool_seen_at,
    newStageAttempt: nextAttempt,
    newNextCheckAt: interval === null ? null : addIso(now, interval),
    detectedTxid: null,
    ...NO_VERDICT,
  };
}
