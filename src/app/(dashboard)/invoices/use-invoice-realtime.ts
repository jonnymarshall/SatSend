"use client";

import { useInvoiceChannel } from "@/lib/realtime/use-invoice-channel";

/**
 * Subscribe to all invoices belonging to the signed-in user (for the /invoices list).
 *
 * Note: no explicit filter — RLS policy `owner_all` already restricts events to rows
 * where auth.uid() = user_id. Relying on RLS is more reliable than a user_id filter,
 * which previously didn't match events correctly in some environments.
 */
export function useInvoiceRealtime(userId: string) {
  useInvoiceChannel({
    channelName: userId ? `invoices:${userId}` : null,
    auth: "session",
    setup: (channel, router) =>
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices" },
        (payload) => {
          console.info(`[invoice-realtime] event`, payload.eventType);
          router.refresh();
        }
      ),
  });
}

/** Subscribe to a single invoice by id (for the /invoices/[id] detail page). */
export function useSingleInvoiceRealtime(invoiceId: string) {
  useInvoiceChannel({
    channelName: invoiceId ? `invoice:${invoiceId}` : null,
    auth: "session",
    setup: (channel, router) =>
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices", filter: `id=eq.${invoiceId}` },
        () => router.refresh()
      ),
  });
}
