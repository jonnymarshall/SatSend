"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { computeInvoiceTotals, LineItem, isValidEmail, lineItemsToJson, MIN_ACCESS_CODE_LENGTH } from "@/lib/invoices";
import { toInvoice, type Invoice } from "@/lib/invoice-public";
import { canPublishInvoice } from "@/lib/invoices/can-publish";
import { sendInvoicePublishedEmail } from "@/lib/email/send";
import { logInvoiceEvent } from "@/lib/invoice-events";
import { decideOverdueFlip } from "@/lib/invoices/overdue-actions";
import { PRE_MEMPOOL_DELAYS_MS } from "@/lib/invoices/payment-schedule";
import { addressHasHistory } from "@/lib/mempool";

async function assertAddressFreshness(address: string, contextId?: string): Promise<void> {
  const hasHistory = await addressHasHistory(address);
  if (hasHistory === true) {
    throw new Error(
      "btc_address: This address has already received transactions — use a fresh address for each invoice.",
    );
  }
  if (hasHistory === null) {
    // Fail closed (v1.4.22-H / M-MONEY-5): we could not confirm the address is
    // unused. An address with prior history would let its old transaction flip
    // this brand-new invoice straight to paid, so refuse rather than guess.
    const ref = contextId ? ` (invoice ${contextId})` : "";
    throw new Error(
      `btc_address: Couldn't verify this address is unused right now${ref} — the network check failed. Please try again in a moment.`,
    );
  }
}

// v1.4.13.6: extracted from loadAndAuthorise so saveDraft and updateDraft can
// run the same uniqueness check at form-submit time. Previously only publish
// ran it, so a draft with a duplicate address would save fine and only fail
// at publish time — confusing fail-late UX.
async function assertAddressUniqueness(
  supabase: Awaited<ReturnType<typeof createClient>>,
  address: string,
  excludeInvoiceId?: string,
): Promise<void> {
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
    throw new Error(
      `btc_address: This bitcoin address has already been used on ${ref}. Please provide a unique address.`,
    );
  }
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

// v1.4.16: cap matches the DB CHECK constraint added in 0020 and the
// `<Input maxLength={30}>` on the form. Server-side guard catches any path
// that bypasses the form (devtools paste, programmatic call, future API).
const INVOICE_NUMBER_MAX_LENGTH = 30;

// v1.4.25-H: cap the line-item count. PDF rendering is CPU-heavy, so an
// unbounded array is a cheap DoS; 100 is far beyond any real invoice.
const MAX_LINE_ITEMS = 100;
function assertLineItemsLength(items: LineItem[] | undefined): void {
  if ((items?.length ?? 0) > MAX_LINE_ITEMS) {
    throw new Error(`line_items: An invoice can have at most ${MAX_LINE_ITEMS} line items.`);
  }
}

// v1.4.26-H: empty is fine, malformed is rejected. Applied on save and again at
// send time (old drafts may carry bad addresses).
function assertClientEmail(email: string | undefined): void {
  if (email && !isValidEmail(email)) {
    throw new Error("client_email: Enter a valid email address, or leave it blank.");
  }
}

// v1.4.26-H: stop an owner setting a one-character code.
function assertAccessCodeLength(code: string | undefined): void {
  if (code && code.length < MIN_ACCESS_CODE_LENGTH) {
    throw new Error(
      `access_code: Access code must be at least ${MIN_ACCESS_CODE_LENGTH} characters.`,
    );
  }
}

function assertInvoiceNumberLength(invoiceNumber: string | null | undefined): void {
  if (invoiceNumber && invoiceNumber.length > INVOICE_NUMBER_MAX_LENGTH) {
    throw new Error(
      `invoice_number: Invoice number must be ${INVOICE_NUMBER_MAX_LENGTH} characters or fewer.`,
    );
  }
}

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

export async function saveDraft(payload: InvoicePayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  assertInvoiceNumberLength(payload.invoice_number);
  assertLineItemsLength(payload.line_items);
  assertClientEmail(payload.client_email);
  assertAccessCodeLength(payload.access_code);

  // v1.4.14: bitcoin-only — validation is gated on address presence alone.
  if (payload.btc_address) {
    await assertAddressUniqueness(supabase, payload.btc_address);
    await assertAddressFreshness(payload.btc_address);
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

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  return data;
}

export async function updateDraft(invoiceId: string, payload: InvoicePayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  assertInvoiceNumberLength(payload.invoice_number);
  assertLineItemsLength(payload.line_items);
  assertClientEmail(payload.client_email);
  assertAccessCodeLength(payload.access_code);

  const { data: existing } = await supabase
    .from("invoices")
    .select("status, user_id")
    .eq("id", invoiceId)
    .single();

  if (!existing || existing.user_id !== user!.id) throw new Error("Invoice not found");
  if (existing.status !== "draft") throw new Error("Only draft invoices can be edited");

  if (payload.btc_address) {
    await assertAddressUniqueness(supabase, payload.btc_address, invoiceId);
    await assertAddressFreshness(payload.btc_address, invoiceId);
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

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath(`/invoices/${invoiceId}`);
  return data;
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

  // v1.4.14: every publish requires a valid btc_address (bitcoin-only).
  const check = canPublishInvoice({ btc_address: invoice.btc_address });
  if (!check.ok) {
    if (check.error === "btc_address_required") {
      throw new Error("btc_address: A bitcoin address is required to publish");
    }
    throw new Error("btc_address: Invalid BTC address");
  }

  // canPublishInvoice above guarantees a valid, non-null address.
  const btcAddress = invoice.btc_address!;
  await assertAddressUniqueness(supabase, btcAddress, invoiceId);
  await assertAddressFreshness(btcAddress, invoice.id);

  return { supabase, invoice: toInvoice(invoice) };
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

export async function publishInvoice(invoiceId: string) {
  const { supabase, invoice } = await loadAndAuthorise(invoiceId);
  await applyPublishUpdate(supabase, invoice, {});
}

export async function publishAndSendEmail(
  invoiceId: string,
): Promise<{
  emailStatus: "sent" | "failed" | "skipped_no_api_key" | "skipped_daily_cap" | "no_recipient";
}> {
  const { supabase, invoice } = await loadAndAuthorise(invoiceId);

  // v1.4.26-H: skip quietly for a missing OR malformed address (old drafts may
  // carry bad ones) — publish-only, no send attempt.
  if (!invoice.client_email || !isValidEmail(invoice.client_email)) {
    await applyPublishUpdate(supabase, invoice, {});
    return { emailStatus: "no_recipient" };
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

  return { emailStatus: outcome.status };
}

export async function publishAndMarkSent(
  invoiceId: string,
  opts: { withDownload?: boolean } = {},
): Promise<{ downloadUrl: string } | undefined> {
  const { supabase, invoice } = await loadAndAuthorise(invoiceId);

  await applyPublishUpdate(supabase, invoice, {
    sent_at: new Date().toISOString(),
    send_method: "manual",
  });

  await logInvoiceEvent({
    invoiceId,
    userId: invoice.user_id,
    eventType: "marked_as_sent",
  });

  if (opts.withDownload) {
    return { downloadUrl: `/api/invoices/${invoiceId}/pdf` };
  }
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

export async function duplicateInvoice(invoiceId: string) {
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
  assertLineItemsLength(toInvoice(source).line_items);

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
