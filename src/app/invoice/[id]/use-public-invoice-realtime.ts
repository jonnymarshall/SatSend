"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { PublicInvoice } from "@/lib/invoice-public";

interface StatusUpdate {
  status?: PublicInvoice["status"];
  btc_txid?: string | null;
}

interface BroadcastRecord {
  id: string;
  status: PublicInvoice["status"];
  btc_txid: string | null;
}

interface BroadcastPayload {
  payload?: {
    record?: BroadcastRecord;
  };
}

/**
 * Public payer page (v1.4.2) Realtime subscription, rewritten in v1.4.20-H
 * (S1) to use a DB-triggered broadcast instead of postgres_changes.
 *
 * The /invoice/[id] page is unauthenticated. anon has no SELECT policy on
 * `invoices` (migration 0022 dropped it), so postgres_changes can no longer
 * be used here. Instead, a trigger on `invoices` (migration 0022/0023)
 * broadcasts a minimal {id, status, btc_txid} record — never the full row —
 * to a channel named `invoice:<id>` whenever a non-draft invoice updates.
 * `realtime.messages` RLS (migration 0023) authorizes anon to receive it, but
 * only once the socket has a JWT attached: `realtime.broadcast_changes()`
 * sends via `realtime.send()`, which marks broadcasts private by default, and
 * private channels are only authorized after `realtime.setAuth()` has run —
 * even for an anonymous client, where it resolves to the anon key rather than
 * a user session. Skipping this call is why an earlier version of this hook
 * silently got CHANNEL_ERROR: the channel opened before the client had
 * presented anything for the `realtime.messages` policy to evaluate.
 */
export function usePublicInvoiceRealtime(
  invoiceId: string,
  onUpdate: (next: StatusUpdate) => void
) {
  const router = useRouter();

  useEffect(() => {
    if (!invoiceId) return;

    const supabase = createClient();
    const channelName = `invoice:${invoiceId}`;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;

      channel = supabase
        .channel(channelName, { config: { private: true } })
        .on(
          "broadcast",
          { event: "UPDATE" },
          (payload: BroadcastPayload) => {
            console.info(`[public-invoice-realtime] broadcast received on ${channelName}`, payload);
            const record = payload.payload?.record;
            if (record) onUpdate({ status: record.status, btc_txid: record.btc_txid });
          }
        )
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            console.info(`[public-invoice-realtime] subscribed: ${channelName}`);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            console.warn(`[public-invoice-realtime] ${status} on ${channelName}`, err);
          }
        });
    })();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) supabase.removeChannel(channel);
    };
  }, [invoiceId, onUpdate, router]);
}
