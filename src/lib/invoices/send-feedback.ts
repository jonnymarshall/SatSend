/*
 * What the Send buttons say afterwards (v1.5.19), shared by the invoice page,
 * the invoice list and the editor. An invoice is a draft or it's sent: if an
 * email to a draft doesn't go out, the draft stays a draft, and the wording says
 * so plainly.
 */

export type EmailStatus = "sent" | "failed" | "skipped_no_api_key" | "skipped_daily_cap" | "no_recipient";

export type SendFeedback = { tone: "notice" | "error"; text: string };

const STILL_DRAFT = "Nothing was sent, so it's still a draft.";

export function emailOutcomeMessage(
  status: EmailStatus,
  { wasDraft, clientEmail }: { wasDraft: boolean; clientEmail: string | null | undefined },
): SendFeedback {
  const draftNote = wasDraft ? ` ${STILL_DRAFT}` : "";
  switch (status) {
    case "sent":
      return {
        tone: "notice",
        text: `Email queued for delivery${clientEmail ? ` to ${clientEmail}` : ""}. See the Email Activity log for the delivery status.`,
      };
    case "failed":
      return {
        tone: "error",
        text: `The email couldn't be sent.${draftNote} See the Email Activity log for the error, then try again or send it another way.`,
      };
    case "skipped_no_api_key":
      return {
        tone: "error",
        text: `Email isn't set up here (RESEND_API_KEY is missing).${draftNote} Send it another way instead.`,
      };
    case "skipped_daily_cap":
      return {
        tone: "error",
        text: `Daily email limit reached (200 emails in 24 hours).${draftNote} Try again later, or send it another way.`,
      };
    case "no_recipient":
      return { tone: "error", text: "No client email is set on this invoice, so it can't be emailed." };
  }
}

/** The page your client opens to view and pay. */
export function clientInvoiceUrl(invoiceId: string, origin: string): string {
  return `${origin}/invoice/${invoiceId}`;
}
