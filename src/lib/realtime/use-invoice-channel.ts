"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type AuthStrategy = "session" | "anon";

export interface UseInvoiceChannelOptions {
  /** Channel name, or null to no-op (empty id/user). */
  channelName: string | null;
  /**
   * "session" attaches the signed-in user's JWT (dashboard; RLS-scoped
   * postgres_changes). "anon" attaches the anon key (public payer page; a private
   * broadcast channel is only authorized after setAuth() runs, even for anon).
   */
  auth: AuthStrategy;
  /** Private broadcast channel (public payer page only). */
  private?: boolean;
  /** Configure subscriptions. `router` is passed for refresh-on-event. */
  setup: (channel: RealtimeChannel, router: ReturnType<typeof useRouter>) => RealtimeChannel;
}

// Bounded reconnect, matching the payment-watcher socket (v1.4.22-H).
const RECONNECT_MAX = 6;

/**
 * One Realtime channel lifecycle for the whole app (v1.4.30-H / M-FE-3). Extracted
 * from two near-duplicate hooks. Adds bounded resubscribe: on CHANNEL_ERROR /
 * TIMED_OUT / CLOSED it reconnects with backoff (1s → 30s, 6 attempts), resetting
 * on a successful subscribe — without this a dropped channel stayed dead until a
 * page reload.
 */
export function useInvoiceChannel({
  channelName,
  auth,
  private: isPrivate,
  setup,
}: UseInvoiceChannelOptions) {
  const router = useRouter();
  const setupRef = useRef(setup);
  // Keep the latest setup without re-subscribing when only the callback changes.
  // Updating the ref in an effect (not during render) satisfies the compiler rule.
  useEffect(() => {
    setupRef.current = setup;
  });

  useEffect(() => {
    if (!channelName) return;

    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    async function connect() {
      if (cancelled) return;

      if (auth === "session") {
        // Supabase Realtime applies RLS using the subscription's JWT. Set it
        // before subscribing, or events are silently dropped.
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session) {
          console.warn("[invoice-realtime] no session — Realtime events will be blocked by RLS");
          return;
        }
        supabase.realtime.setAuth(session.access_token);
      } else {
        await supabase.realtime.setAuth();
      }
      if (cancelled) return;

      const ch = supabase.channel(
        channelName!,
        isPrivate ? { config: { private: true } } : undefined
      );
      channel = setupRef.current(ch, router);
      channel.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          attempts = 0;
          console.info(`[invoice-realtime] subscribed: ${channelName}`);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn(`[invoice-realtime] ${status} on ${channelName}`, err);
          scheduleReconnect();
        }
      });
    }

    function scheduleReconnect() {
      if (cancelled) return;
      if (attempts >= RECONNECT_MAX) {
        console.warn(`[invoice-realtime] gave up reconnecting ${channelName}`);
        return;
      }
      const delay = Math.min(1_000 * 2 ** attempts, 30_000);
      attempts += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
        connect();
      }, delay);
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) supabase.removeChannel(channel);
    };
  }, [channelName, auth, isPrivate, router]);
}
