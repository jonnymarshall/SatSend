// "Is this email registered?" for the Create account page (v1.5.14, roadmap
// v1.5.1.4-H). An email that already has an account is told to log in instead,
// before anything is sent.
//
// The answer reveals whether an email has an account (accepted trade-off), so
// each connection gets 5 checks an hour (v1.5.15, roadmap v1.5.1.5-H), counted
// in the database (`take_signup_check`, migration 0034). Vercel's Hobby plan
// allows one firewall rate-limit rule; that rule (30/min, shared with the public
// invoice routes) also covers this path as an outer layer.
// Logging in needs no such check: Supabase answers it (`otp_disabled`) under its
// own rate limits.

import { createHmac } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Shape check only; Supabase is the judge of what it will send to.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CHECKS_PER_WINDOW = 5;
const WINDOW_SECONDS = 3600;

/**
 * The connection's bucket: an HMAC of its IP keyed with a server-only secret, so
 * the table never holds an address and the values can't be reversed by trying
 * every IP. Vercel sets x-forwarded-for (first entry = the client); locally it
 * may be missing, and every local request shares one bucket.
 */
function clientKey(request: NextRequest): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update(ip).digest("hex");
}

export async function POST(request: NextRequest) {
  let email: unknown;
  try {
    email = ((await request.json()) as { email?: unknown })?.email;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (typeof email !== "string") return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const normalised = email.trim().toLowerCase();
  if (normalised.length > 254 || !EMAIL.test(normalised)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: allowed, error: limitError } = await supabase.rpc("take_signup_check", {
    p_client_key: clientKey(request),
    p_limit: CHECKS_PER_WINDOW,
    p_window_seconds: WINDOW_SECONDS,
  });
  if (limitError) {
    // Fail closed: without the limit this would be an open lookup.
    console.error("[auth/signup-check] rate limit check failed", limitError);
    return NextResponse.json({ error: "Could not check that email" }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "Too many sign-up attempts" }, { status: 429 });
  }

  const { data, error } = await supabase.rpc("is_email_registered", { p_email: normalised });
  if (error) {
    console.error("[auth/signup-check] lookup failed", error);
    return NextResponse.json({ error: "Could not check that email" }, { status: 503 });
  }
  return NextResponse.json({ registered: data === true });
}
