import { createHmac } from "node:crypto";
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

/**
 * What the access cookie holds once the right code is entered (v1.5.26, roadmap
 * v1.5.2.12-H): an HMAC of the invoice and its code, keyed with a server-only
 * secret. It used to hold the code itself, so anyone could guess codes by
 * sending made-up cookies to the PDF or payment-status routes, around the
 * form's guess limit. Now only the server can make a cookie that opens an
 * invoice, and the form is the only place to guess.
 */
export function accessToken(invoiceId: string, code: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Fail closed: with an empty key anyone could make tokens and guess again.
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createHmac("sha256", secret).update(`${invoiceId}:${code.toLowerCase()}`).digest("hex");
}

/** Whether the access cookie's value opens this invoice. */
export function hasAccess(invoiceId: string, required: string | null, cookieValue: string | null | undefined): boolean {
  if (!required) return true;
  if (!cookieValue) return false;
  let expected: string;
  try {
    expected = accessToken(invoiceId, required);
  } catch {
    return false;
  }
  return timingSafeStringEqual(cookieValue, expected);
}
