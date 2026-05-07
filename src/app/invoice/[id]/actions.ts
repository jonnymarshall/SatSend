"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { fetchPublicInvoice } from "@/lib/invoice-public";
import { isAccessCodeValid, accessCookieName } from "@/lib/access-code";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInvoiceMarkedPaidByPayerEmail } from "@/lib/email/send";
import { logInvoiceEvent } from "@/lib/invoice-events";

export type AccessCodeState = { error: string | undefined };

// v1.4.14: payer self-reports a fiat payment from the public invoice page.
// Transitions the invoice to `marked_as_paid`, captures the payment context
// (fiat + manual confirmation), and emails the owner so they can confirm.
//
// The conditional update (.eq id, .eq status, prev) is the idempotency seat-
// belt: if a concurrent submit already flipped the status, the update affects
// 0 rows and we skip the email + event log so a double-click never produces a
// duplicate notification.

const PAYABLE_STATUSES = new Set(["pending", "overdue"]);

export type MarkPaidByPayerResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function markInvoicePaidByPayer(
  invoiceId: string,
): Promise<MarkPaidByPayerResult> {
  const supabase = createAdminClient();

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select(
      "id, user_id, status, invoice_number, client_name, client_email, total_fiat, currency, your_name, your_company, your_email, access_code",
    )
    .eq("id", invoiceId)
    .single();

  if (fetchError || !invoice) {
    return { ok: false, reason: "Invoice not found" };
  }

  // Access-code gate — same cookie the access-code-gate UI sets via
  // verifyAccessCode. We re-verify on the server because the cookie alone
  // can be set by anyone if they know the value, but they can only know
  // the value by going through verifyAccessCode (which checks the invoice).
  if (invoice.access_code) {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(accessCookieName(invoiceId))?.value ?? null;
    if (!isAccessCodeValid(invoice.access_code, cookieValue)) {
      return { ok: false, reason: "Access code required" };
    }
  }

  if (!PAYABLE_STATUSES.has(invoice.status)) {
    return { ok: false, reason: `Invoice is not in a payable state (${invoice.status})` };
  }

  const { data: updated, error: updateError } = await supabase
    .from("invoices")
    .update({
      status: "marked_as_paid",
      payment_method: "fiat",
      payment_confirmation_method: "manual",
    })
    .eq("id", invoiceId)
    .eq("status", invoice.status)
    .select("id");

  if (updateError) {
    return { ok: false, reason: "Failed to update invoice" };
  }

  // Idempotency: if 0 rows matched, another invocation won the race.
  // Treat as success but skip the side effects.
  const rowsAffected = Array.isArray(updated) ? updated.length : 0;
  if (rowsAffected === 0) {
    return { ok: true };
  }

  const { data: userRecord } = await supabase.auth.admin.getUserById(invoice.user_id);
  const ownerEmail = userRecord?.user?.email ?? null;

  if (ownerEmail) {
    await sendInvoiceMarkedPaidByPayerEmail({
      ownerEmail,
      userId: invoice.user_id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      clientName: invoice.client_name || "your client",
      totalFiat: invoice.total_fiat,
      currency: invoice.currency,
    });
  }

  await logInvoiceEvent({
    invoiceId: invoice.id,
    userId: invoice.user_id,
    eventType: "marked_as_paid",
  });

  revalidatePath(`/invoice/${invoiceId}`);
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");

  return { ok: true };
}

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
    maxAge: 60 * 60 * 24 * 7,
    path: `/invoice/${invoiceId}`,
  });

  redirect(`/invoice/${invoiceId}`);
}
