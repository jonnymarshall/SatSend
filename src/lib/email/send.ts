import { getResend, getFromAddress, getAppUrl } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvoicePublishedEmail } from "./templates/invoice-published";
import { PaymentStatusEmail } from "./templates/payment-status-email";
import { LOGO_ATTACHMENT } from "./logo-inline";
import { statusIconAttachment } from "./status-icons-inline";
import { paymentState, type PaymentAudience, type PaymentSummaryInvoice } from "@/lib/invoices/payment-summary";
import { mempoolTxUrl } from "@/lib/btc-network";
import { render } from "@react-email/render";
import type { ReactElement } from "react";

export type EmailType =
  | "invoice_published"
  | "payment_detected"
  | "payment_confirmed";

export interface EmailContext {
  invoiceId: string;
  userId: string;
  type: EmailType;
  recipient: string;
}

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

interface ResendSendResult {
  data?: { id?: string } | null;
  error?: { name?: string; message?: string } | null;
}

export type EmailOutcomeStatus = "sent" | "failed" | "skipped_no_api_key" | "skipped_daily_cap";
export interface EmailOutcome {
  status: EmailOutcomeStatus;
  errorMessage?: string;
}

// v1.4.26-H: per-user daily send cap. Counts email_events rows over a rolling
// 24h. 200 is generous: a busy day (30 invoices published, 20 detected, 20
// confirmed, each emailing owner and payer) can pass 100 without any abuse.
const DAILY_SEND_CAP = 200;

async function isOverDailySendCap(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("email_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  return (count ?? 0) >= DAILY_SEND_CAP;
}

async function safeSend(
  ctx: EmailContext,
  send: () => Promise<ResendSendResult>,
): Promise<EmailOutcome> {
  const admin = createAdminClient();

  // At the cap, skip WITHOUT inserting a row (so the count cannot inflate
  // itself) and never throw — automated callers (the sweep, the fast-path) must
  // keep running, or a capped send would crash detection mid-flight. Callers
  // decide how to surface it.
  try {
    if (await isOverDailySendCap(admin, ctx.userId)) {
      console.warn(
        `[email] skipping ${ctx.type} — daily send cap (${DAILY_SEND_CAP}) reached for user ${ctx.userId}`,
      );
      return { status: "skipped_daily_cap" };
    }
  } catch (err) {
    // A counting failure must never block mail.
    console.error("[email] daily send cap check failed", err);
  }

  const { data: row, error: insertError } = await admin
    .from("email_events")
    .insert({
      invoice_id: ctx.invoiceId,
      user_id: ctx.userId,
      email_type: ctx.type,
      recipient: ctx.recipient,
      status: "queued",
    })
    .select("id")
    .single();

  if (insertError || !row) {
    console.error(`[email] failed to record ${ctx.type} event`, insertError);
    return { status: "failed", errorMessage: insertError?.message };
  }

  const eventId = row.id;

  if (!getResend()) {
    await admin
      .from("email_events")
      .update({ status: "skipped_no_api_key", updated_at: new Date().toISOString() })
      .eq("id", eventId);
    console.warn(`[email] skipping ${ctx.type} — RESEND_API_KEY not set`);
    return { status: "skipped_no_api_key" };
  }

  try {
    const result = await send();
    if (result.error) {
      const message = `Resend ${result.error.name ?? "error"}: ${result.error.message ?? ""}`.trim();
      await admin
        .from("email_events")
        .update({
          status: "failed",
          error_message: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventId);
      console.error(`[email] ${ctx.type} failed`, result.error);
      return { status: "failed", errorMessage: message };
    }
    await admin
      .from("email_events")
      .update({
        status: "sent",
        resend_message_id: result.data?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);
    console.log(`[email] ${ctx.type} sent`);
    return { status: "sent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from("email_events")
      .update({
        status: "failed",
        error_message: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);
    console.error(`[email] ${ctx.type} failed`, err);
    return { status: "failed", errorMessage: message };
  }
}

/**
 * Build a Resend payload (v1.5.0.2-H, deliverability): the HTML from the React
 * template plus a plain-text version of the same email, which spam filters
 * expect, and an optional Reply-To. Client-facing emails reply to the invoice
 * owner, so a client's reply reaches the freelancer instead of SatSend's sender.
 */
async function message(m: {
  to: string;
  subject: string;
  react: ReactElement;
  replyTo?: string | null;
  attachments?: { filename: string; content: string; contentType: string; contentId: string }[];
}) {
  return {
    from: getFromAddress(),
    to: m.to,
    subject: m.subject,
    react: m.react,
    text: await render(m.react, { plainText: true }),
    // EmailLayout's logo is src="cid:satsend-logo" (v1.5.12).
    attachments: [LOGO_ATTACHMENT, ...(m.attachments ?? [])],
    ...(m.replyTo ? { replyTo: m.replyTo } : {}),
  };
}

export interface SendInvoicePublishedArgs {
  to: string;
  userId: string;
  senderName: string;
  clientName: string;
  invoiceId: string;
  invoiceNumber: string | null;
  totalFiat: number;
  currency: string;
  accessCode: string | null;
  dueDateDisplay: string | null;
  /** The invoice owner's email; the client's replies go here. */
  replyTo?: string | null;
}

export async function sendInvoicePublishedEmail(args: SendInvoicePublishedArgs): Promise<EmailOutcome> {
  return await safeSend(
    {
      invoiceId: args.invoiceId,
      userId: args.userId,
      type: "invoice_published",
      recipient: args.to,
    },
    async () => {
      const resend = getResend()!;
      return await resend.emails.send(await message({
        to: args.to,
        replyTo: args.replyTo,
        subject: args.invoiceNumber
          ? `Invoice ${args.invoiceNumber} from ${args.senderName}`
          : `New invoice from ${args.senderName}`,
        react: InvoicePublishedEmail({
          senderName: args.senderName,
          clientName: args.clientName,
          invoiceNumber: args.invoiceNumber,
          totalDisplay: fmtCurrency(args.totalFiat, args.currency),
          invoiceUrl: `${getAppUrl()}/invoice/${args.invoiceId}`,
          accessCode: args.accessCode,
          dueDateDisplay: args.dueDateDisplay,
        }),
      }));
    },
  );
}

export interface SendPaymentStatusArgs {
  ownerEmail: string;
  payerEmail: string | null;
  userId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  senderName: string;
  clientName: string;
  totalFiat: number;
  currency: string;
  txid: string;
  btcAddress: string;
  // The invoice as it stands after this check (v1.5.28): the emails show the
  // same payment block as the client's invoice page, from paymentSummary.
  payment: PaymentSummaryInvoice;
}

/** One payment email to one reader: the shared block, its state's icon inline. */
function paymentMessage(args: SendPaymentStatusArgs, audience: PaymentAudience, to: string, subject: string) {
  const state = paymentState(args.payment);
  return message({
    to,
    subject,
    ...(audience === "client" ? { replyTo: args.ownerEmail } : {}),
    attachments: [statusIconAttachment(state)],
    react: PaymentStatusEmail({
      audience,
      payment: args.payment,
      invoiceNumber: args.invoiceNumber,
      btcAddress: args.btcAddress,
      txid: args.txid,
      mempoolUrl: mempoolTxUrl(args.txid),
      actionUrl:
        audience === "client" ? `${getAppUrl()}/invoice/${args.invoiceId}` : `${getAppUrl()}/invoices/${args.invoiceId}`,
    }),
  });
}

async function sendBoth(
  args: SendPaymentStatusArgs,
  type: "payment_detected" | "payment_confirmed",
  subjects: { owner: string; payer: string },
): Promise<void> {
  await safeSend(
    { invoiceId: args.invoiceId, userId: args.userId, type, recipient: args.ownerEmail },
    async () => getResend()!.emails.send(await paymentMessage(args, "sender", args.ownerEmail, subjects.owner)),
  );

  if (!args.payerEmail) return;

  await safeSend(
    { invoiceId: args.invoiceId, userId: args.userId, type, recipient: args.payerEmail },
    async () => getResend()!.emails.send(await paymentMessage(args, "client", args.payerEmail!, subjects.payer)),
  );
}

export async function sendPaymentDetectedEmail(args: SendPaymentStatusArgs): Promise<void> {
  const n = args.invoiceNumber;
  await sendBoth(args, "payment_detected", {
    owner: n ? `Your client paid invoice ${n}` : "Your client paid an invoice",
    payer: n ? `Your payment for invoice ${n} has been detected` : "Your payment has been detected",
  });
}

export async function sendPaymentConfirmedEmail(args: SendPaymentStatusArgs): Promise<void> {
  const n = args.invoiceNumber;
  const state = paymentState(args.payment);
  const forInvoice = n ? `for invoice ${n}` : "for your invoice";
  // v1.5.28: "Underpaid" replaces "Partial payment"; Overpaid gets its own.
  const subjects =
    state === "underpaid"
      ? { owner: `Underpaid payment ${forInvoice}`, payer: `Underpaid payment ${forInvoice}` }
      : state === "overpaid"
        ? { owner: `Overpayment received ${forInvoice}`, payer: `Overpayment received ${forInvoice}` }
        : {
            owner: n ? `Invoice ${n} confirmed on-chain` : "Your invoice payment is confirmed",
            payer: n ? `Your payment for invoice ${n} is confirmed` : "Your payment is confirmed",
          };
  await sendBoth(args, "payment_confirmed", subjects);
}
