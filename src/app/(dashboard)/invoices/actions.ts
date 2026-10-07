"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { computeInvoiceTotals, LineItem, isValidEmail, lineItemsToJson } from "@/lib/invoices";
import {
  invoiceSchema,
  firstFieldError,
  dbErrorToFieldError,
  type ActionResult,
  type FieldError,
} from "@/lib/invoices/schema";
import { toInvoice, type Invoice } from "@/lib/invoice-public";
import { canPublishInvoice } from "@/lib/invoices/can-publish";
import { sendInvoicePublishedEmail } from "@/lib/email/send";
import { logInvoiceEvent } from "@/lib/invoice-events";
import { decideOverdueFlip } from "@/lib/invoices/overdue-actions";
import { PRE_MEMPOOL_DELAYS_MS } from "@/lib/invoices/payment-schedule";
import { addressHasHistory } from "@/lib/mempool";

async function addressFreshnessError(address: string, contextId?: string): Promise<FieldError | null> {
  const hasHistory = await addressHasHistory(address);
  if (hasHistory === true) {
    return {
      ok: false,
      field: "btc_address",
      message: "This address has already received transactions — use a fresh address for each invoice.",
    };
  }
  if (hasHistory === null) {
    // Fail closed (v1.4.22-H / M-MONEY-5): we could not confirm the address is
    // unused. An address with prior history would let its old transaction flip
    // this brand-new invoice straight to paid, so refuse rather than guess.
    const ref = contextId ? ` (invoice ${contextId})` : "";
    return {
      ok: false,
      field: "btc_address",
      message: `Couldn't verify this address is unused right now${ref} — the network check failed. Please try again in a moment.`,
    };
  }
  return null;
}

// v1.4.13.6: extracted so saveDraft and updateDraft run the same uniqueness
// check at form-submit time, not only at publish.
async function addressUniquenessError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  address: string,
  excludeInvoiceId?: string,
): Promise<FieldError | null> {
  let query = supabase
    .from("invoices")
    .select("id, invoice_number")
    .eq("btc_address", address)
    .neq("status", "draft");

  if (excludeInvoiceId) {
    query = query.neq("id", excludeInvoiceId);
  }

  const { data: conflict } = await query.maybeSingle();

  if (conflict) {
    const ref = conflict.invoice_number
      ? `invoice ${conflict.invoice_number}`
      : `invoice …${conflict.id.slice(-8)}`;
    return {
      ok: false,
      field: "btc_address",
      message: `This bitcoin address has already been used on ${ref}. Please provide a unique address.`,
    };
  }

  // v1.4.31-H (H-DB-3): the lookup above is RLS-scoped, so it cannot see another
  // user's invoice, while the unique index is global. Ask a security-definer RPC
  // so the collision is caught at validation time, not after a failed insert.
  // The message is generic — naming the other tenant's invoice would leak more.
  const { data: registeredElsewhere } = await supabase.rpc("is_address_registered", {
    addr: address,
  });
  if (registeredElsewhere) {
    return {
      ok: false,
      field: "btc_address",
      message:
        "This bitcoin address has already been used on another invoice. Please provide a unique address.",
    };
  }
  return null;
}

export interface InvoicePayload {
  invoice_number?: string;
  your_name?: string;
  your_email?: string;
  your_company?: string;
  your_address?: string;
  your_tax_id?: string;
  client_name?: string;
  client_email?: string;
  client_company?: string;
  client_address?: string;
  client_tax_id?: string;
  line_items: LineItem[];
  tax_percent: number;
  btc_address?: string;
  due_date?: string;
  access_code?: string;
}

// v1.4.16: cap matches the DB CHECK constraint (migration 0020) and the form's
// maxLength. Used by buildDuplicateInvoiceNumber; the input itself is validated
// by invoiceSchema (max 30).
const INVOICE_NUMBER_MAX_LENGTH = 30;

// v1.4.23-H: pick a genuinely unique number. The old version appended a fixed
// "... (copy)", so duplicating an invoice that was already a copy produced the
// same string again and manufactured duplicate numbers (a live prod bug). Walk
// " (copy)", " (copy 2)", ... until one is not already taken, trimming the source
// to fit the 30-char cap. Returns null when source is null/empty so duplicates of
// unnumbered invoices stay unnumbered.
function buildDuplicateInvoiceNumber(
  source: string | null | undefined,
  taken: Set<string>,
): string | null {
  if (!source) return null;
  for (let n = 1; n <= 999; n++) {
    const suffix = n === 1 ? " (copy)" : ` (copy ${n})`;
    const room = INVOICE_NUMBER_MAX_LENGTH - suffix.length;
    const base = source.length > room ? source.slice(0, room) : source;
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}

export async function saveDraft(payload: InvoicePayload): Promise<ActionResult<Invoice>> {
  const parsed = invoiceSchema.safeParse(payload);
  if (!parsed.success) return firstFieldError(parsed.error);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // v1.4.14: bitcoin-only — validation is gated on address presence alone.
  if (payload.btc_address) {
    const uniq = await addressUniquenessError(supabase, payload.btc_address);
    if (uniq) return uniq;
    const fresh = await addressFreshnessError(payload.btc_address);
    if (fresh) return fresh;
  }

  const { subtotal, taxFiat, total } = computeInvoiceTotals(payload.line_items, payload.tax_percent);

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      user_id: user!.id,
      invoice_number: payload.invoice_number || null,
      your_name: payload.your_name || null,
      your_email: payload.your_email ?? "",
      your_company: payload.your_company || null,
      your_address: payload.your_address || null,
      your_tax_id: payload.your_tax_id || null,
      client_name: payload.client_name ?? "",
      client_email: payload.client_email ?? "",
      client_company: payload.client_company || null,
      client_address: payload.client_address || null,
      client_tax_id: payload.client_tax_id || null,
      line_items: lineItemsToJson(payload.line_items),
      tax_percent: payload.tax_percent,
      tax_fiat: taxFiat,
      subtotal_fiat: subtotal,
      total_fiat: total,
      currency: "USD",
      btc_address: payload.btc_address || null,
      due_date: payload.due_date || null,
      access_code: payload.access_code || null,
      status: "draft",
    })
    .select()
    .single();

  if (error) {
    const fieldError = dbErrorToFieldError(error);
    if (fieldError) return fieldError;
    throw new Error(error.message);
  }
  revalidatePath("/dashboard");
  return { ok: true, data: toInvoice(data) };
}

export async function updateDraft(
  invoiceId: string,
  payload: InvoicePayload,
): Promise<ActionResult<Invoice>> {
  const parsed = invoiceSchema.safeParse(payload);
  if (!parsed.success) return firstFieldError(parsed.error);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from("invoices")
    .select("status, user_id")
    .eq("id", invoiceId)
    .single();

  if (!existing || existing.user_id !== user!.id) throw new Error("Invoice not found");
  if (existing.status !== "draft") throw new Error("Only draft invoices can be edited");

  if (payload.btc_address) {
    const uniq = await addressUniquenessError(supabase, payload.btc_address, invoiceId);
    if (uniq) return uniq;
    const fresh = await addressFreshnessError(payload.btc_address, invoiceId);
    if (fresh) return fresh;
  }

  const { subtotal, taxFiat, total } = computeInvoiceTotals(payload.line_items, payload.tax_percent);

  const { data, error } = await supabase
    .from("invoices")
    .update({
      invoice_number: payload.invoice_number || null,
      your_name: payload.your_name || null,
      your_email: payload.your_email ?? "",
      your_company: payload.your_company || null,
      your_address: payload.your_address || null,
      your_tax_id: payload.your_tax_id || null,
      client_name: payload.client_name ?? "",
      client_email: payload.client_email ?? "",
      client_company: payload.client_company || null,
      client_address: payload.client_address || null,
      client_tax_id: payload.client_tax_id || null,
      line_items: lineItemsToJson(payload.line_items),
      tax_percent: payload.tax_percent,
      tax_fiat: taxFiat,
      subtotal_fiat: subtotal,
      total_fiat: total,
      btc_address: payload.btc_address || null,
      due_date: payload.due_date || null,
      access_code: payload.access_code || null,
    })
    .eq("id", invoiceId)
    .select()
    .single();

  if (error) {
    const fieldError = dbErrorToFieldError(error);
    if (fieldError) return fieldError;
    throw new Error(error.message);
  }
  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true, data: toInvoice(data) };
}

async function loadAndAuthorise(invoiceId: string): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  invoice: Invoice;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (fetchError || !invoice) throw new Error("Invoice not found");
  if (invoice.user_id !== user!.id) throw new Error("Forbidden");

  return { supabase, invoice: toInvoice(invoice) };
}

// v1.4.29-H: publish-time field checks, RETURNED (not thrown) so they survive
// production. v1.4.14: every publish requires a valid btc_address.
async function publishFieldError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoice: Invoice,
  invoiceId: string,
): Promise<FieldError | null> {
  const check = canPublishInvoice({ btc_address: invoice.btc_address });
  if (!check.ok) {
    return {
      ok: false,
      field: "btc_address",
      message:
        check.error === "btc_address_required"
          ? "A bitcoin address is required to publish"
          : "Invalid BTC address",
    };
  }
  const btcAddress = invoice.btc_address!;
  const uniq = await addressUniquenessError(supabase, btcAddress, invoiceId);
  if (uniq) return uniq;
  const fresh = await addressFreshnessError(btcAddress, invoice.id);
  if (fresh) return fresh;
  return null;
}

const publishStatePatch = () => ({
  status: "pending",
  // Anchor for the time-based payment schedule (v1.4.28-H / S3). The pre-mempool
  // delay boundaries are measured from here, so this must be the publish moment,
  // not the draft-creation moment.
  published_at: new Date().toISOString(),
  // First cron-side mempool poll lands at publish + PRE_MEMPOOL_DELAYS_MS[0]
  // (single source of truth with the schedule module).
  next_check_at: new Date(Date.now() + PRE_MEMPOOL_DELAYS_MS[0]).toISOString(),
  stage_attempt: 0,
  mempool_seen_at: null,
});

async function applyPublishUpdate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoice: Invoice,
  extra: Record<string, unknown>,
) {
  // If the invoice is already past its due date at publish time, flip
  // straight to overdue so the owner sees the correct status immediately
  // rather than waiting up to 60s for the cron sweep (and never in dev).
  const overdue = decideOverdueFlip(
    { status: "pending", due_date: invoice.due_date },
    new Date(),
  );
  const finalStatus = overdue.shouldFlip ? "overdue" : "pending";

  const { error } = await supabase
    .from("invoices")
    .update({ ...publishStatePatch(), ...extra, status: finalStatus })
    .eq("id", invoice.id);
  if (error) throw new Error(error.message);

  if (overdue.shouldFlip) {
    await logInvoiceEvent({
      invoiceId: invoice.id,
      userId: invoice.user_id,
      eventType: "marked_as_overdue",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${invoice.id}`);
}

export async function publishInvoice(invoiceId: string): Promise<ActionResult<undefined>> {
  const { supabase, invoice } = await loadAndAuthorise(invoiceId);
  const fieldError = await publishFieldError(supabase, invoice, invoiceId);
  if (fieldError) return fieldError;
  await applyPublishUpdate(supabase, invoice, {});
  return { ok: true, data: undefined };
}

export async function publishAndSendEmail(
  invoiceId: string,
): Promise<
  ActionResult<{
    emailStatus: "sent" | "failed" | "skipped_no_api_key" | "skipped_daily_cap" | "no_recipient";
  }>
> {
  const { supabase, invoice } = await loadAndAuthorise(invoiceId);
  const fieldError = await publishFieldError(supabase, invoice, invoiceId);
  if (fieldError) return fieldError;

  // v1.4.26-H: skip quietly for a missing OR malformed address (old drafts may
  // carry bad ones) — publish-only, no send attempt.
  if (!invoice.client_email || !isValidEmail(invoice.client_email)) {
    await applyPublishUpdate(supabase, invoice, {});
    return { ok: true, data: { emailStatus: "no_recipient" } };
  }

  const attemptAt = new Date().toISOString();
  const outcome = await sendInvoicePublishedEmail({
    to: invoice.client_email,
    userId: invoice.user_id,
    senderName: invoice.your_name || invoice.your_company || invoice.your_email || "SatSend user",
    clientName: invoice.client_name || "there",
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    totalFiat: invoice.total_fiat,
    currency: invoice.currency,
    accessCode: invoice.access_code,
    dueDateDisplay: invoice.due_date
      ? format(new Date(invoice.due_date + "T12:00:00"), "MMMM d, yyyy")
      : null,
  });

  const succeeded = outcome.status === "sent";
  await applyPublishUpdate(supabase, invoice, {
    sent_at: succeeded ? attemptAt : null,
    send_method: succeeded ? "email" : null,
    email_attempted_at: attemptAt,
  });

  return { ok: true, data: { emailStatus: outcome.status } };
}

export async function publishAndMarkSent(
  invoiceId: string,
  opts: { withDownload?: boolean } = {},
): Promise<ActionResult<{ downloadUrl?: string }>> {
  const { supabase, invoice } = await loadAndAuthorise(invoiceId);
  const fieldError = await publishFieldError(supabase, invoice, invoiceId);
  if (fieldError) return fieldError;

  await applyPublishUpdate(supabase, invoice, {
    sent_at: new Date().toISOString(),
    send_method: "manual",
  });

  await logInvoiceEvent({
    invoiceId,
    userId: invoice.user_id,
    eventType: "marked_as_sent",
  });

  return {
    ok: true,
    data: opts.withDownload ? { downloadUrl: `/api/invoices/${invoiceId}/pdf` } : {},
  };
}

export async function markPaid(invoiceId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("user_id")
    .eq("id", invoiceId)
    .single();

  if (!invoice || invoice.user_id !== user!.id) throw new Error("Invoice not found");

  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid" })
    .eq("id", invoiceId);

  if (error) throw new Error(error.message);

  await logInvoiceEvent({
    invoiceId,
    userId: invoice.user_id,
    eventType: "marked_as_paid",
  });

  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function deleteDraft(invoiceId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (!invoice || invoice.user_id !== user!.id) throw new Error("Invoice not found");
  if (invoice.status !== "draft") throw new Error("Can only delete draft invoices (only draft invoices may be deleted)");

  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function markUnpaid(invoiceId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("user_id")
    .eq("id", invoiceId)
    .single();

  if (!invoice || invoice.user_id !== user!.id) throw new Error("Invoice not found");

  const { error } = await supabase
    .from("invoices")
    .update({
      status: "pending",
      // Resume monitoring from scratch (v1.4.22-H / M-DB-3): re-anchor the
      // time-based schedule, clear the stale txid and detection amounts so the
      // next sweep starts clean instead of reading a vanished payment.
      published_at: new Date().toISOString(),
      next_check_at: new Date(Date.now() + PRE_MEMPOOL_DELAYS_MS[0]).toISOString(),
      stage_attempt: 0,
      mempool_seen_at: null,
      btc_txid: null,
      amount_received_sats: null,
      btc_price_at_detection: null,
      amount_received_fiat: null,
      overpaid: false,
    })
    .eq("id", invoiceId);

  if (error) throw new Error(error.message);

  await logInvoiceEvent({
    invoiceId,
    userId: invoice.user_id,
    eventType: "marked_as_unpaid",
  });

  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function duplicateInvoice(invoiceId: string): Promise<ActionResult<undefined>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: source } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (!source || source.user_id !== user!.id) throw new Error("Invoice not found");

  // v1.4.25-H: the duplicate copies the source's line items, so it must run the
  // same cap (a pre-existing oversized invoice must not be duplicated into a new
  // oversized one).
  if (toInvoice(source).line_items.length > 100) {
    return { ok: false, field: "line_items", message: "An invoice can have at most 100 line items." };
  }

  // Fetch the numbers this user already has so the duplicate gets a free suffix
  // (v1.4.23-H: the old fixed suffix collided when copying a copy).
  const { data: takenRows } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("user_id", user!.id)
    .not("invoice_number", "is", null);
  const taken = new Set((takenRows ?? []).map((r) => r.invoice_number as string));

  const { data: created, error } = await supabase
    .from("invoices")
    .insert({
      user_id: source.user_id,
      invoice_number: buildDuplicateInvoiceNumber(source.invoice_number, taken),
      your_name: source.your_name,
      your_email: source.your_email ?? "",
      your_company: source.your_company,
      your_address: source.your_address,
      your_tax_id: source.your_tax_id,
      client_name: source.client_name ?? "",
      client_email: source.client_email ?? "",
      client_company: source.client_company,
      client_address: source.client_address,
      client_tax_id: source.client_tax_id,
      line_items: source.line_items,
      tax_percent: source.tax_percent,
      tax_fiat: source.tax_fiat,
      subtotal_fiat: source.subtotal_fiat,
      total_fiat: source.total_fiat,
      currency: source.currency,
      btc_address: null,
      due_date: source.due_date,
      status: "draft",
      access_code: source.access_code,
      btc_txid: null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/invoices");
  redirect(`/invoices/${created.id}/edit`);
}

export async function markOverdue(invoiceId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (!invoice || invoice.user_id !== user!.id) throw new Error("Invoice not found");

  const { error } = await supabase
    .from("invoices")
    .update({ status: "overdue" })
    .eq("id", invoiceId);

  if (error) throw new Error(error.message);

  await logInvoiceEvent({
    invoiceId,
    userId: invoice.user_id,
    eventType: "marked_as_overdue",
  });

  revalidatePath("/dashboard");
}
