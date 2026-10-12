import { EmailButton, EmailHeading, EmailLayout, EmailLink, EmailText, StatusPill, TxidLine } from "./layout";

export interface PaymentConfirmedPayerProps {
  invoiceNumber: string | null;
  senderName: string;
  totalDisplay: string;
  txid: string;
  mempoolUrl: string;
  invoiceUrl: string;
  underpaid?: boolean;
  overpaid?: boolean;
  amountReceivedDisplay?: string | null;
}

export function PaymentConfirmedPayerEmail({
  invoiceNumber,
  senderName,
  totalDisplay,
  txid,
  mempoolUrl,
  invoiceUrl,
  underpaid,
  overpaid,
  amountReceivedDisplay,
}: PaymentConfirmedPayerProps) {
  const label = invoiceNumber ? `invoice ${invoiceNumber}` : "the invoice";
  const heading = underpaid ? "Your partial payment was received" : "Your payment is confirmed";
  return (
    <EmailLayout preview={heading}>
      <StatusPill status={underpaid ? "underpaid" : "paid"} />
      <EmailHeading>{heading}</EmailHeading>
      {underpaid && amountReceivedDisplay ? (
        <EmailText>
          We received <strong>{amountReceivedDisplay}</strong> of the <strong>{totalDisplay}</strong> due to{" "}
          {senderName} for {label} — this does not fully cover the invoice. Please reach out to {senderName} about
          the remaining balance.
        </EmailText>
      ) : (
        <EmailText>
          Your payment of <strong>{totalDisplay}</strong> to {senderName} for {label} is now confirmed on-chain.
          Thanks!
        </EmailText>
      )}
      {overpaid && amountReceivedDisplay && (
        <EmailText>
          Your payment overpaid the invoice: {amountReceivedDisplay} sent against a {totalDisplay} total.
        </EmailText>
      )}
      <EmailButton href={invoiceUrl}>View invoice</EmailButton>
      <EmailText small>
        <EmailLink href={mempoolUrl}>View transaction on mempool.space</EmailLink>
      </EmailText>
      <TxidLine txid={txid} />
    </EmailLayout>
  );
}
