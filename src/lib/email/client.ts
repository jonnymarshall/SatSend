import { Resend } from "resend";

let cached: Resend | null = null;

export function getResend(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cached = new Resend(key);
  return cached;
}

export function getFromAddress(): string {
  return process.env.EMAIL_FROM || "SatSend <onboarding@resend.dev>";
}

// Kept here so email code and its tests keep one import; the logic lives in
// src/lib/app-url.ts (fix/app-url, v1.5.4).
export { getAppUrl } from "@/lib/app-url";
