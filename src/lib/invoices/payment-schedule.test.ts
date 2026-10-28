import { describe, it, expect } from "vitest";
import type { MempoolTx } from "@/lib/mempool";
import {
  decidePaymentSchedule,
  isWithinSlippageTolerance,
  slippageToleranceFiat,
  CONFIRMATION_DEPTH_REQUIRED,
  type PriceContext,
} from "./payment-schedule";
import type { PaymentQuote } from "./quotes";

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
  revertToPending: false,
  confirmedAt: null,
  btcPriceAtSeen: null,
  paymentQuoteId: null,
  slippageToleranceFiat: null,
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

  it("keeps polling every 30 min after the final pre-mempool boundary (v1.5.8)", () => {
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
    // Table total 15s+30s+1m+2m+5m+10m+30m = 48m45s; then every 30 min:
    // 60 min elapsed → next boundary at 78m45s after publish = 18m45s from now.
    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 18 * 60_000 + 45_000).toISOString());
    expect(decision.detectedTxid).toBeNull();
  });

  it("still polls an invoice published days ago (the watch never ends while payable)", () => {
    const decision = decidePaymentSchedule(
      {
        status: "overdue",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
        published_at: new Date(NOW.getTime() - 3 * 24 * 60 * 60_000).toISOString(),
        stage_attempt: 40,
        total_fiat: TOTAL_FIAT,
      },
      [],
      NOW,
      PRICE_FINALIZED
    );
    expect(decision.newNextCheckAt).not.toBeNull();
    const inMs = new Date(decision.newNextCheckAt!).getTime() - NOW.getTime();
    expect(inMs).toBeGreaterThan(0);
    expect(inMs).toBeLessThanOrEqual(30 * 60_000);
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
      btcPriceAtSeen: 50_000,
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

  // v1.5.29: the Slippage Tolerance is 1% of the total, capped at $25. On a $25
  // invoice that is $0.25, which is 500 sats at $50,000/BTC.
  it("98% coverage lands on underpaid", () => {
    // 49,000 sats @ $50,000/BTC = $24.50, $0.50 short of $25.
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, published_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
      [confirmedTx("tx-under", "bc1qaddr", 900_000, 49_000)],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("underpaid");
    expect(decision.amountReceivedSats).toBe(49_000);
    expect(decision.amountReceivedFiat).toBe(24.5);
    expect(decision.overpaid).toBe(false);
    expect(decision.newNextCheckAt).toBeNull();
    expect(decision.slippageToleranceFiat).toBe(0.25);
  });

  it("99% coverage (lower Slippage Tolerance boundary) lands on paid, not underpaid", () => {
    // 49,500 sats @ $50,000/BTC = $24.75 = 99% of $25.
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, published_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
      [confirmedTx("tx-lowbound", "bc1qaddr", 900_000, 49_500)],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("paid");
    expect(decision.overpaid).toBe(false);
  });

  it("101% coverage (upper Slippage Tolerance boundary) lands on paid, not overpaid", () => {
    // 50,500 sats @ $50,000/BTC = $25.25 = 101% of $25.
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, published_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
      [confirmedTx("tx-highbound", "bc1qaddr", 900_000, 50_500)],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("paid");
    expect(decision.overpaid).toBe(false);
  });

  it("102% coverage lands on paid + overpaid", () => {
    // 51,000 sats @ $50,000/BTC = $25.50 = 102% of $25.
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, published_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT },
      [confirmedTx("tx-over", "bc1qaddr", 900_000, 51_000)],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("paid");
    expect(decision.overpaid).toBe(true);
    expect(decision.amountReceivedFiat).toBe(25.5);
  });

  it("the $25 cap applies to large invoices: $25 short is paid, $25.50 short is underpaid", () => {
    const input = { status: "payment_detected" as const, btc_address: "bc1qaddr", mempool_seen_at: SEEN, published_at: SEEN, stage_attempt: 3, total_fiat: 8_000 };
    // $7,975 @ $50,000/BTC = 15,950,000 sats.
    const paid = decidePaymentSchedule(input, [confirmedTx("tx-a", "bc1qaddr", 900_000, 15_950_000)], NOW, PRICE_FINALIZED);
    expect(paid.newStatus).toBe("paid");
    expect(paid.slippageToleranceFiat).toBe(25);
    // $7,974.50 = 15,949,000 sats.
    const under = decidePaymentSchedule(input, [confirmedTx("tx-b", "bc1qaddr", 900_000, 15_949_000)], NOW, PRICE_FINALIZED);
    expect(under.newStatus).toBe("underpaid");
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

describe("decidePaymentSchedule — transaction selection (M-MONEY-3)", () => {
  it("prefers a confirmed payment over an unconfirmed dust tx, even when the dust is listed first", () => {
    const dust = unconfirmedTx("tx-dust", "bc1qaddr", 1_000);
    const real = confirmedTx("tx-real", "bc1qaddr");
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
        published_at: NOW.toISOString(),
        stage_attempt: 0,
        total_fiat: TOTAL_FIAT,
      },
      [dust, real],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("paid");
    expect(decision.detectedTxid).toBe("tx-real");
  });

  it("prefers the amount-matching payment when two unconfirmed txs both pay", () => {
    const small = unconfirmedTx("tx-small", "bc1qaddr", 1_000);
    const right = unconfirmedTx("tx-right", "bc1qaddr", 50_000);
    const decision = decidePaymentSchedule(
      {
        status: "pending",
        btc_address: "bc1qaddr",
        mempool_seen_at: null,
        published_at: NOW.toISOString(),
        stage_attempt: 0,
        total_fiat: TOTAL_FIAT,
      },
      [small, right],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("payment_detected");
    expect(decision.detectedTxid).toBe("tx-right");
  });
});

describe("decidePaymentSchedule — vanished payment revert (M-MONEY-4)", () => {
  it("reverts to pending once a seen payment has been gone longer than the bound", () => {
    const seen = new Date(NOW.getTime() - 2 * 60 * 60_000); // 2h ago
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: seen.toISOString(),
        published_at: new Date(NOW.getTime() - 3 * 60 * 60_000).toISOString(),
        stage_attempt: 4,
        total_fiat: TOTAL_FIAT,
      },
      [],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("pending");
    expect(decision.newMempoolSeenAt).toBeNull();
    expect(decision.newStageAttempt).toBe(0);
    expect(decision.revertToPending).toBe(true);
    expect(decision.newNextCheckAt).toBe(new Date(NOW.getTime() + 15_000).toISOString());
  });

  it("keeps watching (no revert) within the bound", () => {
    const seen = new Date(NOW.getTime() - 30 * 60_000); // 30m ago
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: seen.toISOString(),
        published_at: seen.toISOString(),
        stage_attempt: 1,
        total_fiat: TOTAL_FIAT,
      },
      [],
      NOW,
      PRICE_FINALIZED
    );

    expect(decision.newStatus).toBe("payment_detected");
    expect(decision.revertToPending).toBe(false);
    expect(decision.newNextCheckAt).not.toBeNull();
  });
});

// v1.5.27: the payer's page shows when the payment confirmed, taken from the
// blockchain's own record of the block, not from when SatSend happened to look.
describe("decidePaymentSchedule — confirmation time (v1.5.27)", () => {
  const INPUT = {
    status: "pending" as const,
    btc_address: "bc1qaddr",
    mempool_seen_at: null,
    published_at: NOW.toISOString(),
    stage_attempt: 2,
    total_fiat: TOTAL_FIAT,
  };

  it("a finalized payment records its block's time", () => {
    const tx = confirmedTx("tx-paid", "bc1qaddr");
    tx.status.block_time = 1_793_100_000;
    const decision = decidePaymentSchedule(INPUT, [tx], NOW, PRICE_FINALIZED);
    expect(decision.newStatus).toBe("paid");
    expect(decision.confirmedAt).toBe(new Date(1_793_100_000 * 1000).toISOString());
  });

  it("falls back to now when the block time is missing", () => {
    const decision = decidePaymentSchedule(INPUT, [confirmedTx("tx-paid", "bc1qaddr")], NOW, PRICE_FINALIZED);
    expect(decision.confirmedAt).toBe(NOW.toISOString());
  });

  it("an underpaid verdict records it too", () => {
    const tx = confirmedTx("tx-under", "bc1qaddr", 900_000, 40_000);
    tx.status.block_time = 1_793_100_000;
    const decision = decidePaymentSchedule(INPUT, [tx], NOW, PRICE_FINALIZED);
    expect(decision.newStatus).toBe("underpaid");
    expect(decision.confirmedAt).not.toBeNull();
  });

  it("nothing is recorded before the payment is final", () => {
    const decision = decidePaymentSchedule(INPUT, [unconfirmedTx("tx-u", "bc1qaddr")], NOW, PRICE_FINALIZED);
    expect(decision.newStatus).toBe("payment_detected");
    expect(decision.confirmedAt).toBeNull();
  });
});

describe("Slippage Tolerance (v1.5.29)", () => {
  it("is 1% of the total, capped at $25", () => {
    expect(slippageToleranceFiat(100)).toBe(1);
    expect(slippageToleranceFiat(10)).toBe(0.1);
    expect(slippageToleranceFiat(2_500)).toBe(25);
    expect(slippageToleranceFiat(8_000)).toBe(25);
  });

  it("a payment within it either way counts as paid in full", () => {
    expect(isWithinSlippageTolerance(99, 100)).toBe(true);
    expect(isWithinSlippageTolerance(101, 100)).toBe(true);
    expect(isWithinSlippageTolerance(98.99, 100)).toBe(false);
    expect(isWithinSlippageTolerance(101.01, 100)).toBe(false);
  });

  it("takes the tolerance an invoice was judged with (5% before v1.5.29)", () => {
    expect(isWithinSlippageTolerance(96, 100, 5)).toBe(true);
    expect(isWithinSlippageTolerance(94.99, 100, 5)).toBe(false);
  });
});

// v1.5.29 (roadmap v1.5.2.22-H): a payment that matches a quote is judged in
// bitcoin against it and valued at its price, so price movement drops out.
describe("decidePaymentSchedule — locked quotes (v1.5.29)", () => {
  const SEEN = new Date("2026-04-23T11:50:00.000Z");
  const minutes = (n: number) => n * 60_000;
  // The price fell 20% since the quote: without the quote this would be underpaid.
  const PRICE_MOVED: PriceContext = { btcPrice: 40_000, tipHeight: 900_001 };

  function quote(over: Partial<PaymentQuote> = {}): PaymentQuote {
    return {
      id: "q1",
      amount_sats: 50_000, // $25 at $50,000/BTC
      btc_price: 50_000,
      created_at: new Date(SEEN.getTime() - minutes(5)).toISOString(),
      expires_at: new Date(SEEN.getTime() + minutes(25)).toISOString(),
      ...over,
    };
  }

  function judge(sats: number, quotes: PaymentQuote[], extra: { btc_price_at_seen?: number | null; seen?: Date } = {}) {
    return decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: (extra.seen ?? SEEN).toISOString(),
        published_at: SEEN.toISOString(),
        stage_attempt: 3,
        total_fiat: TOTAL_FIAT,
        btc_price_at_seen: extra.btc_price_at_seen ?? null,
        quotes,
      },
      [confirmedTx("tx", "bc1qaddr", 900_000, sats)],
      NOW,
      PRICE_MOVED
    );
  }

  it("the exact quoted amount is paid, valued at the quoted price: Received equals Requested", () => {
    const decision = judge(50_000, [quote()]);
    expect(decision.newStatus).toBe("paid");
    expect(decision.overpaid).toBe(false);
    expect(decision.amountReceivedFiat).toBe(25);
    expect(decision.btcPriceAtDetection).toBe(50_000);
    expect(decision.paymentQuoteId).toBe("q1");
    expect(decision.slippageToleranceFiat).toBe(0.25);
  });

  it("is judged in bitcoin against the quote: inside the Slippage Tolerance is paid", () => {
    // 400 sats short = $0.20 at the quoted price, inside $0.25.
    expect(judge(49_600, [quote()]).newStatus).toBe("paid");
  });

  it("short of the quote by more than the Slippage Tolerance is underpaid", () => {
    // 1,000 sats short = $0.50.
    const decision = judge(49_000, [quote()]);
    expect(decision.newStatus).toBe("underpaid");
    expect(decision.amountReceivedFiat).toBe(24.5);
  });

  it("over the quote by more than the Slippage Tolerance is overpaid", () => {
    const decision = judge(51_000, [quote()]);
    expect(decision.newStatus).toBe("paid");
    expect(decision.overpaid).toBe(true);
  });

  it("with several valid quotes, the one closest to the amount paid is used", () => {
    const decision = judge(62_500, [quote(), quote({ id: "q2", amount_sats: 62_500, btc_price: 40_000 })]);
    expect(decision.paymentQuoteId).toBe("q2");
    expect(decision.newStatus).toBe("paid");
    expect(decision.amountReceivedFiat).toBe(25);
  });

  it("a payment seen shortly after the quote expired still matches (the background check can lag)", () => {
    const decision = judge(50_000, [quote()], { seen: new Date(SEEN.getTime() + minutes(45)) });
    expect(decision.paymentQuoteId).toBe("q1");
  });

  it("a payment seen long after the quote expired doesn't match it", () => {
    const decision = judge(50_000, [quote()], { seen: new Date(SEEN.getTime() + minutes(60)) });
    expect(decision.paymentQuoteId).toBeNull();
  });

  it("a quote made after the payment was seen doesn't match it", () => {
    const later = quote({ created_at: new Date(SEEN.getTime() + minutes(1)).toISOString() });
    expect(judge(50_000, [later]).paymentQuoteId).toBeNull();
  });

  it("the block time counts when it's earlier than the sighting", () => {
    // Seen an hour after the quote expired, but mined while it was valid.
    const tx = confirmedTx("tx", "bc1qaddr", 900_000, 50_000);
    tx.status.block_time = (SEEN.getTime() + minutes(10)) / 1000;
    const decision = decidePaymentSchedule(
      {
        status: "payment_detected",
        btc_address: "bc1qaddr",
        mempool_seen_at: new Date(SEEN.getTime() + minutes(90)).toISOString(),
        published_at: SEEN.toISOString(),
        stage_attempt: 3,
        total_fiat: TOTAL_FIAT,
        quotes: [quote()],
      },
      [tx],
      NOW,
      PRICE_MOVED
    );
    expect(decision.paymentQuoteId).toBe("q1");
  });

  it("a quote needs no live price: it finalizes while the price service is down", () => {
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN.toISOString(), published_at: SEEN.toISOString(), stage_attempt: 3, total_fiat: TOTAL_FIAT, quotes: [quote()] },
      [confirmedTx("tx", "bc1qaddr", 900_000, 50_000)],
      NOW,
      { btcPrice: null, tipHeight: 900_001 }
    );
    expect(decision.newStatus).toBe("paid");
  });
});

// With no matching quote (paid late, or from the PDF), the payment is valued at
// the price when it was first seen, not when it confirmed.
describe("decidePaymentSchedule — price when first seen (v1.5.29)", () => {
  const SEEN = new Date("2026-04-23T11:40:00.000Z").toISOString();
  const PRICE_MOVED: PriceContext = { btcPrice: 40_000, tipHeight: 900_001 };

  it("the first sighting records the price", () => {
    const decision = decidePaymentSchedule(
      { status: "pending", btc_address: "bc1qaddr", mempool_seen_at: null, published_at: SEEN, stage_attempt: 1, total_fiat: TOTAL_FIAT },
      [unconfirmedTx("tx", "bc1qaddr")],
      NOW,
      PRICE_FINALIZED
    );
    expect(decision.newStatus).toBe("payment_detected");
    expect(decision.btcPriceAtSeen).toBe(50_000);
  });

  it("later checks keep it", () => {
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, published_at: SEEN, stage_attempt: 1, total_fiat: TOTAL_FIAT, btc_price_at_seen: 50_000 },
      [unconfirmedTx("tx", "bc1qaddr")],
      NOW,
      PRICE_MOVED
    );
    expect(decision.btcPriceAtSeen).toBe(50_000);
  });

  it("the verdict values the payment at it, not at the confirmation price", () => {
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, published_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT, btc_price_at_seen: 50_000 },
      [confirmedTx("tx", "bc1qaddr", 900_000, 50_000)],
      NOW,
      PRICE_MOVED
    );
    expect(decision.newStatus).toBe("paid");
    expect(decision.amountReceivedFiat).toBe(25);
    expect(decision.btcPriceAtDetection).toBe(50_000);
    expect(decision.paymentQuoteId).toBeNull();
  });

  it("it finalizes while the price service is down", () => {
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: SEEN, published_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT, btc_price_at_seen: 50_000 },
      [confirmedTx("tx", "bc1qaddr", 900_000, 50_000)],
      NOW,
      { btcPrice: null, tipHeight: 900_001 }
    );
    expect(decision.newStatus).toBe("paid");
  });

  it("a payment first seen already confirmed is valued at the price now, and records it", () => {
    const decision = decidePaymentSchedule(
      { status: "pending", btc_address: "bc1qaddr", mempool_seen_at: null, published_at: SEEN, stage_attempt: 1, total_fiat: TOTAL_FIAT },
      [confirmedTx("tx", "bc1qaddr", 900_000, 62_500)],
      NOW,
      PRICE_MOVED
    );
    expect(decision.newStatus).toBe("paid");
    expect(decision.btcPriceAtSeen).toBe(40_000);
    expect(decision.amountReceivedFiat).toBe(25);
  });

  it("a vanished payment clears it", () => {
    const decision = decidePaymentSchedule(
      { status: "payment_detected", btc_address: "bc1qaddr", mempool_seen_at: new Date(NOW.getTime() - 2 * 60 * 60_000).toISOString(), published_at: SEEN, stage_attempt: 3, total_fiat: TOTAL_FIAT, btc_price_at_seen: 50_000 },
      [],
      NOW,
      PRICE_FINALIZED
    );
    expect(decision.revertToPending).toBe(true);
    expect(decision.btcPriceAtSeen).toBeNull();
  });
});
