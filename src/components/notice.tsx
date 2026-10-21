"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

/*
 * A small confirmation that appears at the bottom of the screen and fades on its
 * own (v1.5.19, first use: "Link copied"). Nothing to close and nothing
 * blocking. Call showNotice() from anywhere; <NoticeHost /> (in the app layout)
 * displays it.
 */

const EVENT = "satsend:notice";
const VISIBLE_MS = 2500;

export function showNotice(message: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

export function NoticeHost() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onNotice(e: Event) {
      setMessage((e as CustomEvent<string>).detail);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), VISIBLE_MS);
    }
    window.addEventListener(EVENT, onNotice);
    return () => {
      window.removeEventListener(EVENT, onNotice);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div
      id="notice"
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      {message ? (
        <p
          id="notice--message"
          className="flex items-center gap-2 rounded-full bg-(--color-ink) px-4 py-2 text-sm font-medium text-white shadow-(--shadow-overlay) motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
        >
          <Check aria-hidden className="size-4 text-(--color-brand)" />
          {message}
        </p>
      ) : null}
    </div>
  );
}
