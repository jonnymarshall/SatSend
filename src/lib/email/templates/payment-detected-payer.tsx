import { EmailButton, EmailHeading, EmailLayout, EmailLink, EmailText, StatusPill, TxidLine } from "./layout";

export interface PaymentDetectedPayerProps {
  invoiceNumber: string | null;
  senderName: string;
  totalDisplay: string;
  txid: string;
  mempoolUrl: string;
  invoiceUrl: string;
}

export function PaymentDetectedPayerEmail({
  invoiceNumber,
  senderName,
  totalDisplay,
  txid,
  mempoolUrl,
  invoiceUrl,
}: PaymentDetectedPayerProps) {
  const label = invoiceNumber ? `invoice ${invoiceNumber}` : "the invoice";
  return (
    <EmailLayout preview={`Your payment of ${totalDisplay} to ${senderName} has been detected.`}>
      <StatusPill status="payment_detected" />
      <EmailHeading>Your payment has been detected</EmailHeading>
      <EmailText>
        Your payment of <strong>{totalDisplay}</strong> to {senderName} for {label} has been broadcast to the Bitcoin
        network.
      </EmailText>
      <EmailText muted>
        The transaction is currently unconfirmed. You&apos;ll get another email once it confirms on-chain.
      </EmailText>
      <EmailButton href={invoiceUrl}>View invoice</EmailButton>
      <EmailText small>
        <EmailLink href={mempoolUrl}>View transaction on mempool.space</EmailLink>
      </EmailText>
      <TxidLine txid={txid} />
    </EmailLayout>
  );
}
