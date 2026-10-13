"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const CHECK_INTERVAL_MS = 60_000;
const FIRST_CHECK_DELAY_MS = 2_000;

/**
 * While /invoices is open and visible, ask the server to check the owner's
 * invoices that are waiting on the blockchain (v1.5.8, roadmap v1.5.0.5-H).
 * Before this, statuses here only moved when someone opened an invoice.
 * Realtime normally refreshes the rows after a change; the refresh below covers
 * a dropped realtime connection.
 */
export function useCheckWaitingPayments(enabled: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const check = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/invoices/check-payments", { method: "POST" });
        if (!res.ok) return;
        const body = (await res.json()) as { transitioned?: number };
        if (!cancelled && (body.transitioned ?? 0) > 0) router.refresh();
      } catch {
        // Offline or server hiccup: the next tick tries again.
      }
    };

    const first = setTimeout(check, FIRST_CHECK_DELAY_MS);
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    // Coming back to the tab checks straight away instead of waiting a minute.
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, router]);
}
