import { useSyncExternalStore } from "react";

// The server renders in UTC; the browser then uses the viewer's own time zone.
// useSyncExternalStore keeps that switch free of hydration mismatches.
const subscribeNever = () => () => {};

export function useTimeZone(): string {
  return useSyncExternalStore(
    subscribeNever,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
}

/** A PDF download link carrying the viewer's time zone for payment times (v1.5.28). */
export function pdfHref(path: string, timeZone: string): string {
  return `${path}?tz=${encodeURIComponent(timeZone)}`;
}
