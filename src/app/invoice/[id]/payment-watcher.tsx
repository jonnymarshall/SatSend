"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { fetchAddressTxs, txPaysToAddress, type MempoolTx } from "@/lib/mempool";
import { getMempoolWsUrl } from "@/lib/btc-network";
import { InvoiceStatusBadge } from "@/components/invoice-status-badge";
import type { Invoice } from "@/lib/invoice-public";

type Status = Invoice["status"];

// v1.4.13.4: phased active-poll cadence. Mirrors the "Mark as Sent" button's
// front-loaded schedule but anchored on reveal (pre-payment) instead of click
// (post-payment), so the window is wider:
//   Phase 1: 12 polls × 5s   = 60s   (matches expected wallet-pay flow)
//   Phase 2:  6 polls × 10s  = 60s
//   Phase 3:  4 polls × 15s  = 60s
//   Phase 4:  2 polls × 30s  = 60s
//   Phase 5:  1 poll  × 60s  = 60s
//   Total:   25 polls over 5 minutes of *visible* time, then stop.
// Pauses while the tab is hidden — wall-clock can exceed 5 minutes.
const ACTIVE_POLL_PHASES: ReadonlyArray<{ intervalMs: number; count: number }> = [
  { intervalMs: 5_000, count: 12 },
  { intervalMs: 10_000, count: 6 },
  { intervalMs: 15_000, count: 4 },
  { intervalMs: 30_000, count: 2 },
  { intervalMs: 60_000, count: 1 },
];

// Returns the wait interval before the (count+1)th poll, or null when exhausted.
function nextActivePollIntervalMs(count: number): number | null {
  let cumulative = 0;
  for (const phase of ACTIVE_POLL_PHASES) {
    cumulative += phase.count;
    if (count < cumulative) return phase.intervalMs;
  }
  return null;
}

interface Props {
  invoiceId: string;
  btcAddress: string;
  status: Status;
  onStatusChange: (s: Status, txid?: string) => void;
  // True once the payer has revealed the BTC address (clicked "Pay now in
  // Bitcoin", or the invoice is already in a paid/detected state). Gates the
  // active alongside-WS poll so window-shoppers don't burn API quota.
  paymentRevealed?: boolean;
}

async function reportStatus(
  invoiceId: string,
  txid: string,
  status: "payment_detected" | "paid"
): Promise<Status | null> {
  const res = await fetch(`/api/invoices/${invoiceId}/payment-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txid, status }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.status ?? null;
}

export function PaymentWatcher({
  invoiceId,
  btcAddress,
  status,
  onStatusChange,
  paymentRevealed = false,
}: Props) {
  const wsRef = useRef<WebSocket | null>(null);
  // v1.4.13.7: track the latest status in a ref so the active-poll closure
  // can decide whether a POST is meaningful, without re-running the effect
  // (which would tear down the WS) every time the status changes.
  const statusRef = useRef(status);
  // useLayoutEffect (vs useEffect) so the ref is synced before the active-poll
  // setTimeout body could read it on a flush after a status change.
  useLayoutEffect(() => {
    statusRef.current = status;
  }, [status]);
  const isPaid = status === "paid";
  // v1.4.14: also bail out when the payer has self-reported a fiat payment.
  // The API endpoint would reject our reports anyway (status not payable),
  // so polling is just wasted work until the owner confirms or disputes.
  const isInactive = isPaid || status === "marked_as_paid";

  useEffect(() => {
    if (isInactive) return;

    let cancelled = false;
    let activeTimer: ReturnType<typeof setTimeout> | null = null;
    let activeCount = 0;

    const isVisible = () =>
      typeof document === "undefined" || document.visibilityState === "visible";

    async function checkRestAndUpdate() {
      const txs = await fetchAddressTxs(btcAddress);
      if (cancelled) return;

      const confirmed = txs.find((tx) => tx.status.confirmed && txPaysToAddress(tx, btcAddress));
      const unconfirmed = txs.find((tx) => !tx.status.confirmed && txPaysToAddress(tx, btcAddress));

      if (confirmed) {
        const next = await reportStatus(invoiceId, confirmed.txid, "paid");
        if (!cancelled && next) {
          onStatusChange(next, confirmed.txid);
          if (next === "paid") closeWebSocket();
        }
      } else if (unconfirmed) {
        // v1.4.13.7: skip the POST if local status is already at-or-past
        // payment_detected. The unconfirmed tx is the same one we (or the
        // server) already recorded — the round-trip would be redundant.
        // The GET above is still useful: we keep watching for a confirmation
        // (which we *would* POST as a real "paid" transition).
        if (statusRef.current === "payment_detected" || statusRef.current === "paid") return;

        const next = await reportStatus(invoiceId, unconfirmed.txid, "payment_detected");
        if (!cancelled && next) {
          onStatusChange(next, unconfirmed.txid);
        }
      }
    }

    function clearActive() {
      if (activeTimer) {
        clearTimeout(activeTimer);
        activeTimer = null;
      }
    }

    function scheduleActivePoll() {
      if (cancelled || !paymentRevealed || !isVisible() || activeTimer) return;
      const intervalMs = nextActivePollIntervalMs(activeCount);
      if (intervalMs === null) return; // all phases exhausted
      activeTimer = setTimeout(async () => {
        activeTimer = null;
        if (cancelled || !paymentRevealed || !isVisible()) return;
        activeCount += 1;
        await checkRestAndUpdate();
        scheduleActivePoll();
      }, intervalMs);
    }

    function onVisibilityChange() {
      if (cancelled) return;
      if (!isVisible()) {
        clearActive();
      } else {
        // scheduleActivePoll no-ops when paymentRevealed=false, so this
        // resume is safe for window-shoppers.
        scheduleActivePoll();
      }
    }

    function closeWebSocket() {
      const ws = wsRef.current;
      if (!ws) return;
      wsRef.current = null;
      // Closing a CONNECTING socket logs a browser warning — override onopen to close
      // cleanly once the connection is established instead of force-closing mid-handshake.
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      } else {
        ws.close();
      }
    }

    function openWebSocket() {
      const ws = new WebSocket(getMempoolWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ action: "want", data: ["blocks"] }));
        ws.send(JSON.stringify({ action: "track-address", data: btcAddress }));
      };

      ws.onmessage = async (event) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        const blockTxs = msg["address-block-transactions"] as MempoolTx[] | undefined;
        const mempoolTxs = msg["address-transactions"] as MempoolTx[] | undefined;

        if (blockTxs) {
          const tx = blockTxs.find((t) => txPaysToAddress(t, btcAddress));
          if (tx) {
            const next = await reportStatus(invoiceId, tx.txid, "paid");
            if (!cancelled && next) {
              onStatusChange(next, tx.txid);
              if (next === "paid") closeWebSocket();
            }
          }
        } else if (mempoolTxs) {
          const tx = mempoolTxs.find((t) => txPaysToAddress(t, btcAddress));
          if (tx) {
            // v1.4.13.7: skip redundant POST if status is already at-or-past
            // payment_detected (same logic as the REST branch above).
            if (statusRef.current === "payment_detected" || statusRef.current === "paid") return;

            const next = await reportStatus(invoiceId, tx.txid, "payment_detected");
            if (!cancelled && next) {
              onStatusChange(next, tx.txid);
            }
          }
        }
      };

      ws.onerror = (event) => {
        console.warn("[PaymentWatcher] WebSocket error, falling back to polling", event);
        ws.close();
      };

      ws.onclose = () => {
        wsRef.current = null;
        // v1.4.13.3: no client-side fallback when WS dies. The active
        // alongside-WS poll (scheduleActivePoll) is already running on its
        // own 5s cadence for revealed payers; for unrevealed viewers, the
        // cron is the safety net. The vestigial v1.4.13 exp-backoff
        // fallback was removed because it overlapped with the active poll
        // and produced irregular polling clusters.
      };
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    checkRestAndUpdate();
    openWebSocket();
    scheduleActivePoll();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      closeWebSocket();
      clearActive();
    };
  }, [invoiceId, btcAddress, onStatusChange, isInactive, paymentRevealed]);

  return <InvoiceStatusBadge status={status} id="invoice-view--status" />;
}
