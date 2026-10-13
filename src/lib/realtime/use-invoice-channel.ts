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

    // v1.5.10 (v1.5.0.1-H): supabase.channel(name) hands back a channel that is
    // still registered under the same topic, and removeChannel() only drops it
    // once the server acknowledges the unsubscribe. Re-opening before then (leave
    // and return, Strict Mode, or a reconnect) got the old, already-subscribed
    // channel, and setup's .on() threw. Wait until no channel holds the topic.
    async function removeSameTopicChannels() {
      const topic = `realtime:${channelName}`;
      const stale = supabase.getChannels().filter((c) => c.topic === topic);
      await Promise.all(stale.map((c) => supabase.removeChannel(c)));
      if (supabase.getChannels().some((c) => c.topic === topic)) {
        throw new Error(`channel ${topic} is still registered after removal`);
      }
    }

    async function connect() {
      try {
        await openChannel();
      } catch (err) {
        console.error(`[invoice-realtime] connect failed on ${channelName}`, err);
        scheduleReconnect();
      }
    }

    async function openChannel() {
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

      await removeSameTopicChannels();
      if (cancelled) return;

      const ch = supabase.channel(
        channelName!,
        isPrivate ? { config: { private: true } } : undefined
      );
      const current = setupRef.current(ch, router);
      channel = current;
      current.subscribe((status, err) => {
        // A replaced channel reports CLOSED when we remove it; that is not a new
        // drop, and reacting to it would start a reconnect loop.
        // After unmount, our own removal reports CLOSED too: not a drop.
        if (cancelled || channel !== current) return;
        if (status === "SUBSCRIBED") {
          const recovered = attempts > 0;
          attempts = 0;
          if (recovered) {
            // warn, not info, so the recovery shows next to the drop warning
            // (Next forwards only warn/error to the dev terminal by default).
            console.warn(`[invoice-realtime] reconnected: ${channelName}`);
          } else {
            console.info(`[invoice-realtime] subscribed: ${channelName}`);
          }
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
        // connect() removes the dropped channel (and waits for it) first.
        channel = null;
        void connect();
      }, delay);
    }

    void connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) supabase.removeChannel(channel);
    };
  }, [channelName, auth, isPrivate, router]);
}
