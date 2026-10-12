import { EmailButton, EmailHeading, EmailLayout, EmailLink, EmailText, Panel, PanelRow } from "./layout";

export interface InvoicePublishedProps {
  senderName: string;
  clientName: string;
  invoiceNumber: string | null;
  totalDisplay: string;
  invoiceUrl: string;
  accessCode: string | null;
  dueDateDisplay: string | null;
}

export function InvoicePublishedEmail({
  senderName,
  clientName,
  invoiceNumber,
  totalDisplay,
  invoiceUrl,
  accessCode,
  dueDateDisplay,
}: InvoicePublishedProps) {
  const label = invoiceNumber ? `Invoice ${invoiceNumber}` : "A new invoice";
  return (
    <EmailLayout preview={`${senderName} has sent you an invoice for ${totalDisplay}, payable in bitcoin.`}>
      <EmailHeading>
        {label} from {senderName}
      </EmailHeading>
      <EmailText>Hi {clientName},</EmailText>
      <EmailText>
        {senderName} has sent you an invoice for <strong>{totalDisplay}</strong>, payable in bitcoin.
      </EmailText>
      <Panel>
        <PanelRow label="Amount due" value={totalDisplay} strong />
        {dueDateDisplay ? <PanelRow label="Due" value={dueDateDisplay} /> : null}
        {accessCode ? (
          <PanelRow
            label="Access code (you'll need this to open the invoice)"
            value={<span style={{ fontFamily: "'Geist Mono', ui-monospace, Menlo, monospace", letterSpacing: "0.12em" }}>{accessCode}</span>}
          />
        ) : null}
      </Panel>
      <EmailButton href={invoiceUrl}>View and pay</EmailButton>
      <EmailText muted small>
        Or open this link: <EmailLink href={invoiceUrl}>{invoiceUrl}</EmailLink>
      </EmailText>
    </EmailLayout>
  );
}
