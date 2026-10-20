// "Is this email registered?" for the Create account page (v1.5.14, roadmap
// v1.5.1.4-H). An email that already has an account is told to log in instead,
// before anything is sent.
//
// The answer reveals whether an email has an account (accepted trade-off). This
// path has its own Vercel firewall rule (`signup-check rate limit`: 5 POSTs an
// hour per IP, 429 beyond) so it can't be used to test lists of addresses.
// Logging in needs no such check: Supabase answers it (`otp_disabled`) under its
// own rate limits.

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Shape check only; Supabase is the judge of what it will send to.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const { data, error } = await createAdminClient().rpc("is_email_registered", { p_email: normalised });
  if (error) {
    console.error("[auth/signup-check] lookup failed", error);
    return NextResponse.json({ error: "Could not check that email" }, { status: 503 });
  }
  return NextResponse.json({ registered: data === true });
}
