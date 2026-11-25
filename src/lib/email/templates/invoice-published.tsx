import { EmailButton, EmailHeading, EmailLayout, EmailLink, EmailText, Panel, PanelRow, ReferenceCode } from "./layout";
import { REFERENCE_LABEL } from "@/lib/invoices/reference";

export interface InvoicePublishedProps {
  senderName: string;
  clientName: string;
  invoiceNumber: string | null;
  /** The SatSend reference, bare (v1.5.31). */
  reference: string;
  totalDisplay: string;
  invoiceUrl: string;
  accessCode: string | null;
  dueDateDisplay: string | null;
}

export function InvoicePublishedEmail({
  senderName,
  clientName,
  invoiceNumber,
  reference,
  totalDisplay,
  invoiceUrl,
  accessCode,
  dueDateDisplay,
}: InvoicePublishedProps) {
  // v1.5.36 (roadmap v1.4.26): the subject carries who and how much, so the
  // heading is the invoice itself rather than a repeat of the subject.
  const heading = invoiceNumber ? `Invoice ${invoiceNumber}` : "Your invoice";
  return (
    <EmailLayout preview={`${senderName} has sent you an invoice for ${totalDisplay}, payable in bitcoin.`}>
      <EmailHeading>{heading}</EmailHeading>
      <EmailText>Hi {clientName},</EmailText>
      <EmailText>
        {senderName} has sent you an invoice for <strong>{totalDisplay}</strong>, payable in bitcoin.
      </EmailText>
      <Panel>
        <PanelRow label="Amount due" value={totalDisplay} strong />
        {dueDateDisplay ? <PanelRow label="Due" value={dueDateDisplay} /> : null}
        <PanelRow label={REFERENCE_LABEL} value={<ReferenceCode reference={reference} />} />
        {accessCode ? (
          <PanelRow
            label="Access code (you'll need this to open the invoice)"
            value={<span style={{ fontFamily: "'Geist Mono', ui-monospace, Menlo, monospace", letterSpacing: "0.12em" }}>{accessCode}</span>}
          />
        ) : null}
      </Panel>
      {/* v1.5.36: how bitcoin payment works, before the client clicks through.
          SatSend never holds the money: it goes straight to the sender. */}
      <EmailText>
        <strong>How to pay</strong>
        <br />
        1. Open the invoice with the button below{accessCode ? " and enter the access code" : ""}.
        <br />
        2. Send the exact bitcoin amount shown, from any bitcoin wallet, to the address on the page.
        <br />
        3. You and {senderName} will both get an email when the payment arrives.
      </EmailText>
      <EmailText muted small>
        The bitcoin amount is worked out at the current rate when you open the invoice. Your payment goes
        straight to {senderName}.
      </EmailText>
      <EmailButton href={invoiceUrl}>View and pay</EmailButton>
      <EmailText muted small>
        Or open this link: <EmailLink href={invoiceUrl}>{invoiceUrl}</EmailLink>
      </EmailText>
    </EmailLayout>
  );
}
