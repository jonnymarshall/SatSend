import { describe, it, expect } from "vitest";
import type { MempoolTx } from "@/lib/mempool";
import { decidePaymentSchedule, CONFIRMATION_DEPTH_REQUIRED, type PriceContext } from "./payment-schedule";

const NOW = new Date("2026-04-23T12:00:00.000Z");

// 50,000 sats at $50,000/BTC = $25 — matches TOTAL_FIAT below for a clean
// (non-under/over) paid verdict in tests that don't care about the amount.
const TOTAL_FIAT = 25;
const PRICE_FINALIZED: PriceContext = { btcPrice: 50_000, tipHeight: 900_001 }; // depth 2 over block_height 900_000

function confirmedTx(txid: string, address: string, blockHeight = 900_000, sats = 50_000): MempoolTx {
  return {
    txid,
    status: { confirmed: true, block_height: blockHeight },
    vout: [{ scriptpubkey_address: address, value: sats }],
  };
}

function unconfirmedTx(txid: string, address: string, sats = 50_000): MempoolTx {
  return {
    txid,
    status: { confirmed: false },
    vout: [{ scriptpubkey_address: address, value: sats }],
  };
}

const NO_VERDICT = {
  amountReceivedSats: null,
  btcPriceAtDetection: null,
  amountReceivedFiat: null,
  overpaid: false,
};

// Time-based scheduling (v1.4.28-H / S3): the next check is the first cumulative
// boundary past the elapsed time measured from the invoice's anchor
// (published_at pre-mempool, mempool_seen_at post-mempool).
describe("decidePaymentSchedule — pre-mempool (status=pending, mempool_seen_at=null)", () => {
  // Pre-mempool boundaries (ms from published_at): 15s, 45s, 105s, 225s, 525s,
  // 1125s, 2925s — cumulative sums of [15s, 30s, 60s, 2min, 5min, 10min, 30min].

  it("a freshly published invoice schedules its first check at anchor + 15s", () => {
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
        published_at: NOW.toISOString(),
        stage_attempt: 0,
        total_fiat: TOTAL_FIAT,
      },
      [],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision).toEqual({
      newStatus: "pending",
      newMempoolSeenAt: null,
      newStageAttempt: 1,
      newNextCheckAt: new Date(NOW.getTime() + 15_000).toISOString(),
      detectedTxid: null,
      ...NO_VERDICT,
    });
  });

  it("a tick landing at anchor + 15s schedules the next boundary at anchor + 45s", () => {
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
        published_at: new Date(NOW.getTime() - 15_000).toISOString(),
        stage_attempt: 0,
        total_fiat: TOTAL_FIAT,
      },
      [],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStageAttempt).toBe(1);
    // anchor + 45s = (NOW - 15s) + 45s = NOW + 30s
    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 30_000).toISOString());
  });

  it("a missed tick does not burn stages: a tick 10 min late jumps to the correct boundary", () => {
    // The old attempt-count schedule would have advanced one step (~10 min).
    // Time-based instead lands on the 1125s (18.75 min) boundary.
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
        published_at: new Date(NOW.getTime() - 10 * 60_000).toISOString(),
        stage_attempt: 0,
        total_fiat: TOTAL_FIAT,
      },
      [],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStageAttempt).toBe(1); // one tick, not several
    // 1125s boundary − 600s elapsed = 525s from now (8.75 min)
    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 525_000).toISOString());
  });

  it("stops polling once the final pre-mempool boundary is in the past", () => {
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
        published_at: new Date(NOW.getTime() - 60 * 60_000).toISOString(),
        stage_attempt: 6,
        total_fiat: TOTAL_FIAT,
      },
      [],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("pending");
    expect(decision.newNextCheckAt).toBeNull();
    expect(decision.detectedTxid).toBeNull();
  });

  it("an overdue invoice rests as overdue while it keeps polling", () => {
    const decision = decidePaymentSchedule(
      {
        status: "overdue",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
        published_at: NOW.toISOString(),
        stage_attempt: 0,
        total_fiat: TOTAL_FIAT,
      },
      [],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("overdue");
    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 15_000).toISOString());
  });

  it("with an unconfirmed paying tx, transitions pending → payment_detected, resets stage_attempt to 0, sets mempool_seen_at, schedules +10m", () => {
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
        published_at: NOW.toISOString(),
        stage_attempt: 1,
        total_fiat: TOTAL_FIAT,
      },
      [unconfirmedTx("tx-seen", "bc1qaddr")],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision).toEqual({
      newStatus: "payment_detected",
      newMempoolSeenAt: NOW.toISOString(),
      newStageAttempt: 0,
      newNextCheckAt: new Date(NOW.getTime() + 10 * 60_000).toISOString(),
      detectedTxid: "tx-seen",
      ...NO_VERDICT,
    });
  });

  it("with a confirmed paying tx at sufficient depth and a clean amount, transitions straight to paid and stops polling", () => {
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
        published_at: NOW.toISOString(),
        stage_attempt: 2,
        total_fiat: TOTAL_FIAT,
      },
      [confirmedTx("tx-paid", "bc1qaddr")],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("paid");
    expect(decision.newNextCheckAt).toBeNull();
    expect(decision.detectedTxid).toBe("tx-paid");
    expect(decision.amountReceivedSats).toBe(50_000);
    expect(decision.amountReceivedFiat).toBe(25);
    expect(decision.overpaid).toBe(false);
  });

  it("ignores txs that do not pay to the invoice's btc_address", () => {
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
        published_at: NOW.toISOString(),
        stage_attempt: 0,
        total_fiat: TOTAL_FIAT,
      },
      [confirmedTx("tx-other", "bc1qsomeoneelse")],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("pending");
    expect(decision.detectedTxid).toBeNull();
    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 15_000).toISOString());
  });
});

describe("decidePaymentSchedule — post-mempool (status=payment_detected)", () => {
  // Post-mempool boundaries (ms from mempool_seen_at): 10m, 20m, 30m, 90m, 150m,
  // 210m, 270m, 330m, 390m, then +4h ×12, then +8h ×24.

  it("a tick at seen + 10m schedules the next boundary at seen + 20m", () => {
    const seen = new Date(NOW.getTime() - 10 * 60_000);
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: seen.toISOString(),
        published_at: seen.toISOString(),
        stage_attempt: 1,
        total_fiat: TOTAL_FIAT,
      },
      [unconfirmedTx("tx-still", "bc1qaddr")],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("payment_detected");
    expect(decision.newMempoolSeenAt).toBe(seen.toISOString());
    expect(decision.newStageAttempt).toBe(2);
    // seen + 20m = NOW + 10m
    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 10 * 60_000).toISOString());
    expect(decision.detectedTxid).toBeNull();
  });

  it("at the end of the 10-minute stage, the next boundary is 1 hour after seen", () => {
    const seen = new Date(NOW.getTime() - 30 * 60_000);
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: seen.toISOString(),
        published_at: seen.toISOString(),
        stage_attempt: 2,
        total_fiat: TOTAL_FIAT,
      },
      [unconfirmedTx("tx-still", "bc1qaddr")],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 60 * 60_000).toISOString());
  });

  it("at the end of the 1-hour stage, the next boundary is 4 hours after seen", () => {
    const seen = new Date(NOW.getTime() - 390 * 60_000); // 6.5h
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: seen.toISOString(),
        published_at: seen.toISOString(),
        stage_attempt: 8,
        total_fiat: TOTAL_FIAT,
      },
      [unconfirmedTx("tx-still", "bc1qaddr")],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStageAttempt).toBe(9);
    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 4 * 60 * 60_000).toISOString());
  });

  it("at the end of the 4-hour stage, the next boundary is 8 hours after seen", () => {
    const seen = new Date(NOW.getTime() - 3270 * 60_000); // 54.5h
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: seen.toISOString(),
        published_at: seen.toISOString(),
        stage_attempt: 20,
        total_fiat: TOTAL_FIAT,
      },
      [unconfirmedTx("tx-still", "bc1qaddr")],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStageAttempt).toBe(21);
    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 8 * 60 * 60_000).toISOString());
  });

  it("stops polling after the final post-mempool boundary", () => {
    const seen = new Date(NOW.getTime() - 300 * 60 * 60_000); // 300h
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: seen.toISOString(),
        published_at: seen.toISOString(),
        stage_attempt: 44,
        total_fiat: TOTAL_FIAT,
      },
      [unconfirmedTx("tx-still", "bc1qaddr")],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("payment_detected");
    expect(decision.newNextCheckAt).toBeNull();
    expect(decision.detectedTxid).toBeNull();
  });

  it("when the tx confirms at sufficient depth with a clean amount, transitions to paid and stops polling", () => {
    const seen = new Date(NOW.getTime() - 60 * 60_000);
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: seen.toISOString(),
        published_at: seen.toISOString(),
        stage_attempt: 5,
        total_fiat: TOTAL_FIAT,
      },
      [confirmedTx("tx-confirmed", "bc1qaddr")],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("paid");
    expect(decision.newNextCheckAt).toBeNull();
    expect(decision.detectedTxid).toBe("tx-confirmed");
  });

  it("preserves mempool_seen_at when the tx has not yet confirmed", () => {
    const seen = new Date(NOW.getTime() - 10 * 60_000);
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: seen.toISOString(),
        published_at: seen.toISOString(),
        stage_attempt: 0,
        total_fiat: TOTAL_FIAT,
      },
      [unconfirmedTx("tx-still", "bc1qaddr")],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newMempoolSeenAt).toBe(seen.toISOString());
  });
});

describe("decidePaymentSchedule — amount verification", () => {
  const SEEN = new Date("2026-04-23T10:00:00.000Z").toISOString();

  it("90% coverage lands on underpaid", () => {
    // 45,000 sats @ $50,000/BTC = $22.50, against a $25 total = 90% coverage.
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, published_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
      [confirmedTx("tx-under", "bc1qaddr", 900_000, 45_000)],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("underpaid");
    expect(decision.amountReceivedSats).toBe(45_000);
    expect(decision.amountReceivedFiat).toBe(22.5);
    expect(decision.overpaid).toBe(false);
    expect(decision.newNextCheckAt).toBeNull();
  });

  it("95% coverage (lower tolerance boundary) lands on paid, not underpaid", () => {
    // 47,500 sats @ $50,000/BTC = $23.75 = 95% of $25.
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, published_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
      [confirmedTx("tx-lowbound", "bc1qaddr", 900_000, 47_500)],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("paid");
    expect(decision.overpaid).toBe(false);
  });

  it("105% coverage (upper tolerance boundary) lands on paid, not overpaid", () => {
    // 52,500 sats @ $50,000/BTC = $26.25 = 105% of $25.
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, published_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
      [confirmedTx("tx-highbound", "bc1qaddr", 900_000, 52_500)],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("paid");
    expect(decision.overpaid).toBe(false);
  });

  it("110% coverage lands on paid + overpaid", () => {
    // 55,000 sats @ $50,000/BTC = $27.50 = 110% of $25.
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, published_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
      [confirmedTx("tx-over", "bc1qaddr", 900_000, 55_000)],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("paid");
    expect(decision.overpaid).toBe(true);
    expect(decision.amountReceivedFiat).toBe(27.5);
  });

  it("defers (no status flip) when the BTC price oracle is unavailable, even at sufficient confirmation depth", () => {
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, published_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
      [confirmedTx("tx-confirmed", "bc1qaddr")],
      NOW,
      { btcPrice: null, tipHeight: 900_001 }
    );

    expect(decision.newStatus).toBe("payment_detected");
    expect(decision.detectedTxid).toBeNull();
    expect(decision.amountReceivedSats).toBeNull();
    // Still advances the post-mempool cadence so the next tick retries.
    expect(decision.newStageAttempt).toBe(4);
    expect(decision.newNextCheckAt).not.toBeNull();
  });

  it("does not finalize a confirmed tx below the required confirmation depth", () => {
    // block_height 900_000, tip 900_000 -> depth 1, below CONFIRMATION_DEPTH_REQUIRED (2).
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, published_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
      [confirmedTx("tx-shallow", "bc1qaddr")],
      NOW,
      { btcPrice: 50_000, tipHeight: 900_000 }
    );

    expect(CONFIRMATION_DEPTH_REQUIRED).toBe(2);
    expect(decision.newStatus).toBe("payment_detected");
    expect(decision.detectedTxid).toBeNull();
    expect(decision.amountReceivedSats).toBeNull();
    expect(decision.newNextCheckAt).not.toBeNull();
  });

  it("defers a first-sighting confirmed-but-shallow tx into payment_detected rather than finalizing", () => {
    const decision = decidePaymentSchedule(
      { status: "pending", btc_address: "bc1qaddr", mempool_seen_at: null, published_at: NOW.toISOString(), stage_attempt: 1, total_fiat: TOTAL_FIAT },
      [confirmedTx("tx-shallow-first-seen", "bc1qaddr")],
      NOW,
      { btcPrice: 50_000, tipHeight: 900_000 }
    );

    expect(decision.newStatus).toBe("payment_detected");
    expect(decision.newMempoolSeenAt).toBe(NOW.toISOString());
    expect(decision.detectedTxid).toBe("tx-shallow-first-seen");
    expect(decision.amountReceivedSats).toBeNull();
  });
});
