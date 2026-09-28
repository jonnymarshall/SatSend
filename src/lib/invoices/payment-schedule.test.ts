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

describe("decidePaymentSchedule — pre-mempool (status=pending, mempool_seen_at=null)", () => {
  // v1.4.13.5 schedule: [15s (publish-time), 30s, 60s, 2min, 5min, 10min, 30min].
  // Pre-v1.4.13.5 was [15s, 5min, 10min, 30min] — the post-first-miss leap to
  // 5min meant tx broadcasts that mempool.space indexed at t=60–120s sat
  // undetected by cron until t=300s. New schedule fills in the gap.
  it("after attempt 0 with no paying tx, schedules next check 30s out and increments stage_attempt (v1.4.13.5)", () => {
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
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
      newNextCheckAt: new Date(NOW.getTime() + 30_000).toISOString(),
      detectedTxid: null,
      ...NO_VERDICT,
    });
  });

  it("after attempt 1 with no paying tx, schedules next check 60s out (v1.4.13.5)", () => {
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
        stage_attempt: 1,
        total_fiat: TOTAL_FIAT,
      },
      [],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStageAttempt).toBe(2);
    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 60_000).toISOString());
  });

  it("after attempt 2 with no paying tx, schedules next check 2min out (v1.4.13.5)", () => {
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
        stage_attempt: 2,
        total_fiat: TOTAL_FIAT,
      },
      [],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStageAttempt).toBe(3);
    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 2 * 60_000).toISOString());
  });

  it("after attempt 3 with no paying tx, schedules next check 5min out (v1.4.13.5)", () => {
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
        stage_attempt: 3,
        total_fiat: TOTAL_FIAT,
      },
      [],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStageAttempt).toBe(4);
    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 5 * 60_000).toISOString());
  });

  it("after attempt 6 (final pre-mempool, was attempt 3 pre-v1.4.13.5) with no paying tx, stops polling", () => {
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
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

  it("with an unconfirmed paying tx, transitions pending → payment_detected, resets stage_attempt to 0, sets mempool_seen_at, schedules +10m", () => {
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
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
        stage_attempt: 0,
        total_fiat: TOTAL_FIAT,
      },
      [confirmedTx("tx-other", "bc1qsomeoneelse")],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("pending");
    expect(decision.detectedTxid).toBeNull();
    // v1.4.13.5: attempt-0 retry is now 30s (was 5min)
    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 30_000).toISOString());
  });
});

describe("decidePaymentSchedule — post-mempool (status=payment_detected)", () => {
  const SEEN = new Date("2026-04-23T10:00:00.000Z").toISOString();

  it("at the end of the 10-minute stage (attempt 2), the next interval is 1 hour", () => {
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: SEEN,
        stage_attempt: 2,
        total_fiat: TOTAL_FIAT,
      },
      [unconfirmedTx("tx-still", "bc1qaddr")],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("payment_detected");
    expect(decision.newMempoolSeenAt).toBe(SEEN);
    expect(decision.newStageAttempt).toBe(3);
    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 60 * 60_000).toISOString());
    expect(decision.detectedTxid).toBeNull();
  });

  it("at the end of the 1-hour stage (attempt 8), the next interval is 4 hours", () => {
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: SEEN,
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

  it("at the end of the 4-hour stage (attempt 20), the next interval is 8 hours", () => {
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: SEEN,
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

  it("at the final attempt (44) with still-unconfirmed tx, stops polling", () => {
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: SEEN,
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
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: SEEN,
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
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: SEEN,
        stage_attempt: 0,
        total_fiat: TOTAL_FIAT,
      },
      [unconfirmedTx("tx-still", "bc1qaddr")],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newMempoolSeenAt).toBe(SEEN);
  });
});

describe("decidePaymentSchedule — amount verification", () => {
  const SEEN = new Date("2026-04-23T10:00:00.000Z").toISOString();

  it("90% coverage lands on underpaid", () => {
    // 45,000 sats @ $50,000/BTC = $22.50, against a $25 total = 90% coverage.
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
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
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
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
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
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
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
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
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
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
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
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
      { status: "pending", btc_address: "bc1qaddr", mempool_seen_at: null, stage_attempt: 1, total_fiat: TOTAL_FIAT },
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
