import { createHmac } from "node:crypto";

/**
 * A connection's rate-limit bucket (v1.5.15; shared from v1.5.26): an HMAC of its
 * IP keyed with a server-only secret, so the database never holds an address and
 * the values can't be reversed by trying every IP. Vercel sets x-forwarded-for
 * (first entry = the client); locally it may be missing, and every local request
 * shares one bucket.
 */
export function clientKey(headers: Headers): string {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update(ip).digest("hex");
}
