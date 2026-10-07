"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchPublicInvoice } from "@/lib/invoice-public";
import { isAccessCodeValid, accessCookieName } from "@/lib/access-code";

export type AccessCodeState = { error: string | undefined };

export async function verifyAccessCode(
  invoiceId: string,
  _prevState: AccessCodeState,
  formData: FormData
) {
  const submitted = (formData.get("access_code") as string | null)?.trim() ?? null;
  const invoice = await fetchPublicInvoice(invoiceId);

  if (!invoice) redirect("/");

  if (!isAccessCodeValid(invoice.access_code, submitted)) {
    return { error: "Incorrect access code. Please try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set(accessCookieName(invoiceId), submitted ?? "", {
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

  redirect(`/invoice/${invoiceId}`);
}
