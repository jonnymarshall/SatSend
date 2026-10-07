"use client";

import { useInvoiceChannel } from "@/lib/realtime/use-invoice-channel";
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
 * Public payer page (v1.4.2) Realtime subscription, rewritten in v1.4.20-H (S1) to
 * use a DB-triggered broadcast instead of postgres_changes. The /invoice/[id] page is
 * unauthenticated, so anon has no SELECT policy on `invoices`; a trigger broadcasts a
 * minimal {id, status, btc_txid} record to the private channel `invoice:<id>`, which
 * `realtime.messages` RLS authorizes once setAuth() has run. This wrapper supplies the
 * "anon" auth strategy and the private-broadcast subscription style.
 */
export function usePublicInvoiceRealtime(
  invoiceId: string,
  onUpdate: (next: StatusUpdate) => void
) {
  useInvoiceChannel({
    channelName: invoiceId ? `invoice:${invoiceId}` : null,
    auth: "anon",
    private: true,
    setup: (channel) =>
      channel.on("broadcast", { event: "UPDATE" }, (payload: BroadcastPayload) => {
        console.info(
          `[public-invoice-realtime] broadcast received on invoice:${invoiceId}`,
          payload
        );
        const record = payload.payload?.record;
        if (record) onUpdate({ status: record.status, btc_txid: record.btc_txid });
      }),
  });
}
