"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { fetchPublicInvoice } from "@/lib/invoice-public";
import { isAccessCodeValid, accessCookieName, accessToken } from "@/lib/access-code";
import { clientKey } from "@/lib/client-key";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseInvoiceKey, publicInvoicePath } from "@/lib/invoices/reference";

export type AccessCodeState = { error: string | undefined };

// v1.5.26 (roadmap v1.5.2.12-H): 5 wrong guesses per 15 minutes, per connection,
// per invoice, counted in the database (`take_access_code_guess`, migration 0036).
// No cap per invoice across connections, so a stranger can't lock the client out.
const WRONG_GUESSES_PER_WINDOW = 5;
const WINDOW_SECONDS = 15 * 60;

// v1.5.31: `invoiceKey` is what the client's link holds, a SatSend reference
// (ss-7k3qx9ab) or an old UUID. Everything behind the code screen (the guess
// limit, the cookie) uses the invoice's UUID, so unlocking it on one link form
// unlocks it on the other; the client lands back on the kind of link they used,
// rebuilt from the invoice rather than echoed from the form.
export async function verifyAccessCode(
  invoiceKey: string,
  _prevState: AccessCodeState,
  formData: FormData
) {
  const submitted = (formData.get("access_code") as string | null)?.trim() ?? null;
  const invoice = await fetchPublicInvoice(invoiceKey);

  if (!invoice) redirect("/");
  const invoiceId = invoice.id;
  const back =
    parseInvoiceKey(invoiceKey)?.kind === "reference" ? publicInvoicePath(invoice) : `/invoice/${invoiceId}`;
  if (!invoice.access_code) redirect(back);

  const correct = isAccessCodeValid(invoice.access_code, submitted);

  const { data: allowed, error } = await createAdminClient().rpc("take_access_code_guess", {
    p_invoice_id: invoiceId,
    p_client_key: clientKey(await headers()),
    p_wrong: !correct,
    p_limit: WRONG_GUESSES_PER_WINDOW,
    p_window_seconds: WINDOW_SECONDS,
  });
  if (error) {
    // Fail closed: without the limit, codes could be guessed freely.
    console.error("[invoice/access-code] guess limit check failed", error);
    return { error: "We couldn't check that code. Please try again." };
  }
  // Refuse the right code too once the limit is reached, or the answer would
  // still tell a guesser which code is right.
  if (!allowed) {
    return { error: "Too many wrong tries. Please wait 15 minutes and try again." };
  }
  if (!correct) {
    return { error: "Incorrect access code. Please try again." };
  }

  const cookieStore = await cookies();
  // A server-made fingerprint, never the code itself (v1.5.26): made-up cookies
  // can't open the invoice, so this form is the only place to guess.
  cookieStore.set(accessCookieName(invoiceId), accessToken(invoiceId, invoice.access_code), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    // Path "/" (not "/invoice/<id>") so the same cookie also reaches the
    // invoice's API routes (the public PDF and the payer fast-path), which live
    // under /api/. The cookie name is per-invoice, so unlocking one invoice
    // cannot unlock another. (v1.4.25-H / H-SEC-1)
    path: "/",
  });

  redirect(back);
}
