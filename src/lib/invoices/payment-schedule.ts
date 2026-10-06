import { txPaysToAddress, confirmationDepth, type MempoolTx } from "@/lib/mempool";

// Payment polling schedule.
//
// v1.4.28-H (S3): the schedule is TIME-BASED. The next check is derived from
// elapsed wall-clock time against the delay tables, so a missed or late tick
// lands on the correct boundary instead of consuming a stage.
//
// The anchors:
//   • pre-mempool  → published_at   (set at publish; see publishStatePatch)
//   • post-mempool → mempool_seen_at (set when a paying tx is first seen)
//
export const PRE_MEMPOOL_DELAYS_MS: readonly number[] = [
  15_000,        // [0] publish → first cron check
  30_000,        // first miss → retry in 30s
  60_000,        // second miss → retry in 60s
  2 * 60_000,    // third miss → retry in 2min
  5 * 60_000,    // fourth miss → retry in 5min
  10 * 60_000,   // fifth miss → retry in 10min
  30 * 60_000,   // sixth miss → retry in 30min, then stop
];

export const POST_MEMPOOL_STAGES: ReadonlyArray<{ count: number; intervalMs: number }> = [
  { count: 3, intervalMs: 10 * 60_000 },
  { count: 6, intervalMs: 60 * 60_000 },
  { count: 12, intervalMs: 4 * 60 * 60_000 },
  { count: 24, intervalMs: 8 * 60 * 60_000 },
];

// Flattened post-mempool interval list (e.g. [10m,10m,10m, 1h ×6, 4h ×12, 8h ×24]).
// Cumulative sums of this list are the wall-clock boundaries after mempool_seen_at.
const POST_MEMPOOL_INTERVALS_MS: readonly number[] = POST_MEMPOOL_STAGES.flatMap((stage) =>
  Array.from({ length: stage.count }, () => stage.intervalMs)
);

// If a payment was seen but then vanished (replaced via RBF, or evicted from the
// mempool) and has not reappeared within this window, stop treating the invoice
// as mid-payment and resume watching for a fresh one. Without this an invoice
// whose tx disappears sits in `payment_detected` forever. (v1.4.22-H / M-MONEY-4)
export const REVERT_TO_PENDING_AFTER_MS = 60 * 60_000;

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
// as final, to absorb short reorgs (a 1-confirmation tx can still be reorged
// out; two is the pragmatic safety margin).
export const CONFIRMATION_DEPTH_REQUIRED = 2;

export interface ScheduleInput {
  status: "pending" | "payment_detected" | "overdue";
  btc_address: string;
  mempool_seen_at: string | null;
  published_at: string | null;
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
  newStatus: "pending" | "payment_detected" | "overdue" | "paid" | "underpaid";
  newMempoolSeenAt: string | null;
  newStageAttempt: number;
  newNextCheckAt: string | null;
  detectedTxid: string | null;
  amountReceivedSats: number | null;
  btcPriceAtDetection: number | null;
  amountReceivedFiat: number | null;
  overpaid: boolean;
  // True when a previously-seen payment has vanished and the invoice should be
  // put back to a clean `pending` (caller clears btc_txid and re-anchors the
  // schedule). (v1.4.22-H / M-MONEY-4)
  revertToPending: boolean;
}

const NO_VERDICT = {
  amountReceivedSats: null,
  btcPriceAtDetection: null,
  amountReceivedFiat: null,
  overpaid: false,
  revertToPending: false,
} as const;

function sumVouts(tx: MempoolTx, address: string): number {
  return tx.vout
    .filter((o) => o.scriptpubkey_address === address)
    .reduce((sum, o) => sum + o.value, 0);
}

/**
 * Choose the best paying transaction when several touch the address. mempool.space
 * returns unconfirmed txs first, so taking the first match can leave an invoice
 * stuck on a dust payment while a real confirmed one sits behind it. Prefer a
 * confirmed tx, then the one whose amount is closest to what the invoice asked
 * for, then the largest. (v1.4.22-H / M-MONEY-3)
 */
function pickPayingTx(
  txs: MempoolTx[],
  address: string,
  totalFiat: number,
  btcPrice: number | null
): MempoolTx | null {
  const paying = txs.filter((tx) => txPaysToAddress(tx, address));
  if (paying.length === 0) return null;

  const expectedSats = btcPrice && btcPrice > 0 ? (totalFiat / btcPrice) * 1e8 : null;
  const score = (tx: MempoolTx) => {
    const received = sumVouts(tx, address);
    return {
      confirmed: tx.status.confirmed && tx.status.block_height !== undefined,
      // With no price, fall back to "largest wins" (a smaller delta the larger
      // the amount). Otherwise the closest to the expected amount wins.
      amountDelta: expectedSats === null ? -received : Math.abs(received - expectedSats),
      received,
    };
  };

  return paying.slice().sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa.confirmed !== sb.confirmed) return sa.confirmed ? -1 : 1;
    if (sa.amountDelta !== sb.amountDelta) return sa.amountDelta - sb.amountDelta;
    return sb.received - sa.received;
  })[0];
}

/**
 * First cumulative boundary (ms from the anchor) strictly greater than the
 * elapsed time, or null once every boundary is in the past. This is what makes
 * the schedule time-based: a tick that arrives late (or is missed entirely)
 * lands on the correct boundary rather than advancing one step.
 */
function nextBoundaryAfterMs(intervals: readonly number[], elapsedMs: number): number | null {
  let cumulative = 0;
  for (const interval of intervals) {
    cumulative += interval;
    if (cumulative > elapsedMs) return cumulative;
  }
  return null;
}

function addIso(from: Date, ms: number): string {
  return new Date(from.getTime() + ms).toISOString();
}

export function decidePaymentSchedule(
  input: ScheduleInput,
  txs: MempoolTx[],
  now: Date,
  price: PriceContext
): ScheduleDecision {
  const paying = pickPayingTx(txs, input.btc_address, input.total_fiat, price.btcPrice);

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
        revertToPending: false,
      };
    }

    // Seen (confirmed-but-shallow, or unconfirmed) but not yet finalized.
    if (input.mempool_seen_at === null) {
      // First sighting: anchor the post-mempool cadence to now.
      const boundary = nextBoundaryAfterMs(POST_MEMPOOL_INTERVALS_MS, 0);
      return {
        newStatus: "payment_detected",
        newMempoolSeenAt: now.toISOString(),
        newStageAttempt: 0,
        newNextCheckAt: boundary === null ? null : addIso(now, boundary),
        detectedTxid: paying.txid,
        ...NO_VERDICT,
      };
    }

    const seenAt = new Date(input.mempool_seen_at);
    const boundary = nextBoundaryAfterMs(
      POST_MEMPOOL_INTERVALS_MS,
      now.getTime() - seenAt.getTime()
    );
    return {
      newStatus: "payment_detected",
      newMempoolSeenAt: input.mempool_seen_at,
      newStageAttempt: input.stage_attempt + 1,
      newNextCheckAt: boundary === null ? null : addIso(seenAt, boundary),
      detectedTxid: null,
      ...NO_VERDICT,
    };
  }

  const restingStatus: "pending" | "overdue" =
    input.status === "overdue" ? "overdue" : "pending";

  if (input.mempool_seen_at === null) {
    const anchor = input.published_at;
    if (anchor === null) {
      // No publish anchor (e.g. a row predating the column). Retry soon rather
      // than silently stopping the watch.
      return {
        newStatus: restingStatus,
        newMempoolSeenAt: null,
        newStageAttempt: input.stage_attempt + 1,
        newNextCheckAt: addIso(now, PRE_MEMPOOL_DELAYS_MS[0]),
        detectedTxid: null,
        ...NO_VERDICT,
      };
    }

    const anchorDate = new Date(anchor);
    const boundary = nextBoundaryAfterMs(
      PRE_MEMPOOL_DELAYS_MS,
      now.getTime() - anchorDate.getTime()
    );
    return {
      newStatus: restingStatus,
      newMempoolSeenAt: null,
      newStageAttempt: input.stage_attempt + 1,
      newNextCheckAt: boundary === null ? null : addIso(anchorDate, boundary),
      detectedTxid: null,
      ...NO_VERDICT,
    };
  }

  // A tx was seen earlier but is absent this poll (dropped or reorged).
  const seenAt = new Date(input.mempool_seen_at);
  const elapsed = now.getTime() - seenAt.getTime();

  if (elapsed > REVERT_TO_PENDING_AFTER_MS) {
    // It has not come back within the bound: the payment is gone. Return the
    // invoice to a clean pending state and restart the pre-mempool watch. The
    // caller clears btc_txid and re-anchors published_at. (M-MONEY-4)
    return {
      newStatus: "pending",
      newMempoolSeenAt: null,
      newStageAttempt: 0,
      newNextCheckAt: addIso(now, PRE_MEMPOOL_DELAYS_MS[0]),
      detectedTxid: null,
      amountReceivedSats: null,
      btcPriceAtDetection: null,
      amountReceivedFiat: null,
      overpaid: false,
      revertToPending: true,
    };
  }

  const boundary = nextBoundaryAfterMs(POST_MEMPOOL_INTERVALS_MS, elapsed);
  return {
    newStatus: "payment_detected",
    newMempoolSeenAt: input.mempool_seen_at,
    newStageAttempt: input.stage_attempt + 1,
    newNextCheckAt: boundary === null ? null : addIso(seenAt, boundary),
    detectedTxid: null,
    ...NO_VERDICT,
  };
}
