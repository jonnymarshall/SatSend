"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The locked quote the QR shows (v1.5.29, roadmap v1.5.2.22-H). Asked for when
 * the client clicks "Pay now in Bitcoin", and asked for again when it expires,
 * so the amount on screen is always one the server recorded and will judge the
 * payment against.
 */
export interface Quote {
  amountSats: number;
  btcPrice: number;
  expiresAt: string;
}

export type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; quote: Quote }
  | { status: "error" };

/** How often an open page checks the clock for an expired amount. */
const EXPIRY_CHECK_MS = 15_000;

export function useQuote(invoiceId: string, active: boolean): QuoteState & { retry: () => void } {
  // Bumped to ask again: on expiry, or when the client taps "Try again".
  const [round, setRound] = useState(0);
  const retry = useCallback(() => setRound((r) => r + 1), []);
  // The answer to a round; until it arrives for the current one, it's loading.
  const [answer, setAnswer] = useState<{ round: number; state: QuoteState } | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    // A sleeping computer pauses timers, and on waking they carry on from where
    // they stopped, so the expiry timer alone can show an expired amount for up
    // to the time asleep. Check the real clock on coming back, and every so often.
    let expiresAtMs = Infinity;
    const checkExpiry = () => {
      if (!cancelled && Date.now() >= expiresAtMs) {
        cancelled = true; // ask once, however many checks fire together
        retry();
      }
    };
    fetch(`/api/invoices/${invoiceId}/quote`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`quote ${res.status}`);
        const quote = (await res.json()) as Quote;
        if (cancelled) return;
        setAnswer({ round, state: { status: "ready", quote } });
        expiresAtMs = Date.parse(quote.expiresAt);
        expiry = setTimeout(checkExpiry, Math.max(0, expiresAtMs - Date.now()));
        poll = setInterval(checkExpiry, EXPIRY_CHECK_MS);
      })
      .catch(() => {
        if (!cancelled) setAnswer({ round, state: { status: "error" } });
      });
    document.addEventListener("visibilitychange", checkExpiry);
    window.addEventListener("focus", checkExpiry);
    window.addEventListener("pageshow", checkExpiry);
    return () => {
      cancelled = true;
      clearTimeout(expiry);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", checkExpiry);
      window.removeEventListener("focus", checkExpiry);
      window.removeEventListener("pageshow", checkExpiry);
      // A quote must never outlive its watch (say, shown again after a payment vanished).
      setAnswer(null);
    };
  }, [invoiceId, active, round, retry]);

  const state: QuoteState = !active
    ? { status: "idle" }
    : answer?.round === round
      ? answer.state
      : { status: "loading" };
  return { ...state, retry };
}
