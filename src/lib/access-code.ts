import { timingSafeStringEqual } from "@/lib/timing-safe";

export function isAccessCodeValid(
  required: string | null,
  provided: string | null | undefined
): boolean {
  if (!required) return true;
  if (!provided) return false;
  // Case-insensitive, and constant-time (v1.4.25-H) so the compare cannot be
  // timed. Access codes are low-value secrets, but the helper is already here.
  return timingSafeStringEqual(provided.toLowerCase(), required.toLowerCase());
}

export function accessCookieName(invoiceId: string): string {
  return `pb_access_${invoiceId}`;
}
