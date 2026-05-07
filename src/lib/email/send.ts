import { getResend, getFromAddress, getAppUrl } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvoicePublishedEmail } from "./templates/invoice-published";
import { PaymentDetectedOwnerEmail } from "./templates/payment-detected-owner";
import { PaymentDetectedPayerEmail } from "./templates/payment-detected-payer";
import { PaymentConfirmedOwnerEmail } from "./templates/payment-confirmed-owner";
import { PaymentConfirmedPayerEmail } from "./templates/payment-confirmed-payer";
import { InvoiceMarkedPaidByPayerEmail } from "./templates/invoice-marked-paid-by-payer";
import { mempoolTxUrl } from "@/lib/btc-network";

export type EmailType =
  | "invoice_published"
  | "payment_detected"
  | "payment_confirmed"
  | "invoice_marked_paid_by_payer";

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

export type EmailOutcomeStatus = "sent" | "failed" | "skipped_no_api_key";
export interface EmailOutcome {
  status: EmailOutcomeStatus;
  errorMessage?: string;
}

async function safeSend(
  ctx: EmailContext,
  send: () => Promise<ResendSendResult>,
): Promise<EmailOutcome> {
  const admin = createAdminClient();

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
      return await resend.emails.send({
        from: getFromAddress(),
        to: args.to,
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
      });
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
}

const InvoiceLabel = (n: string | null) => (n ? `Invoice ${n}` : "Your invoice");

export async function sendPaymentDetectedEmail(args: SendPaymentStatusArgs): Promise<void> {
  const totalDisplay = fmtCurrency(args.totalFiat, args.currency);
  const mempoolUrl = mempoolTxUrl(args.txid);

  await safeSend(
    {
      invoiceId: args.invoiceId,
      userId: args.userId,
      type: "payment_detected",
      recipient: args.ownerEmail,
    },
    async () => {
      const resend = getResend()!;
      return await resend.emails.send({
        from: getFromAddress(),
        to: args.ownerEmail,
        subject: args.invoiceNumber
          ? `Your client paid invoice ${args.invoiceNumber}`
          : "Your client paid an invoice",
        react: PaymentDetectedOwnerEmail({
          invoiceNumber: args.invoiceNumber,
          clientName: args.clientName,
          totalDisplay,
          txid: args.txid,
          mempoolUrl,
          dashboardUrl: `${getAppUrl()}/invoices/${args.invoiceId}`,
        }),
      });
    },
  );

  if (!args.payerEmail) return;

  await safeSend(
    {
      invoiceId: args.invoiceId,
      userId: args.userId,
      type: "payment_detected",
      recipient: args.payerEmail,
    },
    async () => {
      const resend = getResend()!;
      return await resend.emails.send({
        from: getFromAddress(),
        to: args.payerEmail!,
        subject: args.invoiceNumber
          ? `Your payment for invoice ${args.invoiceNumber} has been detected`
          : "Your payment has been detected",
        react: PaymentDetectedPayerEmail({
          invoiceNumber: args.invoiceNumber,
          senderName: args.senderName,
          totalDisplay,
          txid: args.txid,
          mempoolUrl,
          invoiceUrl: `${getAppUrl()}/invoice/${args.invoiceId}`,
        }),
      });
    },
  );
}

// v1.4.14: client self-reports a fiat payment from the public page; we
// can't verify off-chain payments automatically, so we ping the owner to
// confirm receipt and either approve (→ paid) or dispute (→ pending).
export interface SendInvoiceMarkedPaidByPayerArgs {
  ownerEmail: string;
  userId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  clientName: string;
  totalFiat: number;
  currency: string;
}

export async function sendInvoiceMarkedPaidByPayerEmail(
  args: SendInvoiceMarkedPaidByPayerArgs,
): Promise<EmailOutcome> {
  return await safeSend(
    {
      invoiceId: args.invoiceId,
      userId: args.userId,
      type: "invoice_marked_paid_by_payer",
      recipient: args.ownerEmail,
    },
    async () => {
      const resend = getResend()!;
      return await resend.emails.send({
        from: getFromAddress(),
        to: args.ownerEmail,
        subject: args.invoiceNumber
          ? `${args.clientName} marked invoice ${args.invoiceNumber} as paid in ${args.currency}`
          : `${args.clientName} marked your invoice as paid in ${args.currency}`,
        react: InvoiceMarkedPaidByPayerEmail({
          invoiceNumber: args.invoiceNumber,
          clientName: args.clientName,
          totalDisplay: fmtCurrency(args.totalFiat, args.currency),
          currency: args.currency,
          dashboardUrl: `${getAppUrl()}/invoices/${args.invoiceId}`,
        }),
      });
    },
  );
}

export async function sendPaymentConfirmedEmail(args: SendPaymentStatusArgs): Promise<void> {
  const totalDisplay = fmtCurrency(args.totalFiat, args.currency);
  const mempoolUrl = mempoolTxUrl(args.txid);

  await safeSend(
    {
      invoiceId: args.invoiceId,
      userId: args.userId,
      type: "payment_confirmed",
      recipient: args.ownerEmail,
    },
    async () => {
      const resend = getResend()!;
      return await resend.emails.send({
        from: getFromAddress(),
        to: args.ownerEmail,
        subject: args.invoiceNumber
          ? `${InvoiceLabel(args.invoiceNumber)} confirmed on-chain`
          : "Your invoice payment is confirmed",
        react: PaymentConfirmedOwnerEmail({
          invoiceNumber: args.invoiceNumber,
          clientName: args.clientName,
          totalDisplay,
          txid: args.txid,
          mempoolUrl,
          dashboardUrl: `${getAppUrl()}/invoices/${args.invoiceId}`,
        }),
      });
    },
  );

  if (!args.payerEmail) return;

  await safeSend(
    {
      invoiceId: args.invoiceId,
      userId: args.userId,
      type: "payment_confirmed",
      recipient: args.payerEmail,
    },
    async () => {
      const resend = getResend()!;
      return await resend.emails.send({
        from: getFromAddress(),
        to: args.payerEmail!,
        subject: args.invoiceNumber
          ? `Your payment for invoice ${args.invoiceNumber} is confirmed`
          : "Your payment is confirmed",
        react: PaymentConfirmedPayerEmail({
          invoiceNumber: args.invoiceNumber,
          senderName: args.senderName,
          totalDisplay,
          txid: args.txid,
          mempoolUrl,
          invoiceUrl: `${getAppUrl()}/invoice/${args.invoiceId}`,
        }),
      });
    },
  );
}

