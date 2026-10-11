import { EmailButton, EmailHeading, EmailLayout, EmailLink, EmailText, StatusPill, TxidLine } from "./layout";

export interface PaymentDetectedOwnerProps {
  invoiceNumber: string | null;
  clientName: string;
  totalDisplay: string;
  txid: string;
  mempoolUrl: string;
  dashboardUrl: string;
}

export function PaymentDetectedOwnerEmail({
  invoiceNumber,
  clientName,
  totalDisplay,
  txid,
  mempoolUrl,
  dashboardUrl,
}: PaymentDetectedOwnerProps) {
  const label = invoiceNumber ? `invoice ${invoiceNumber}` : "your invoice";
  return (
    <EmailLayout preview={`${clientName} sent ${totalDisplay} for ${label}. Waiting for confirmation.`}>
      <StatusPill status="payment_detected" />
      <EmailHeading>Your client paid {label}</EmailHeading>
      <EmailText>
        {clientName} just sent <strong>{totalDisplay}</strong> for {label}. The transaction is broadcast to the
        Bitcoin network and currently unconfirmed.
      </EmailText>
      <EmailText muted>You&apos;ll get another email once it confirms.</EmailText>
      <EmailButton href={dashboardUrl}>Open in SatSend</EmailButton>
      <EmailText small>
        <EmailLink href={mempoolUrl}>View transaction on mempool.space</EmailLink>
      </EmailText>
      <TxidLine txid={txid} />
    </EmailLayout>
  );
}
