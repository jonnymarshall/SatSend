import { EmailButton, EmailHeading, EmailLayout, EmailLink, EmailText, StatusPill, TxidLine } from "./layout";

export interface PaymentConfirmedOwnerProps {
  invoiceNumber: string | null;
  clientName: string;
  totalDisplay: string;
  txid: string;
  mempoolUrl: string;
  dashboardUrl: string;
  underpaid?: boolean;
  overpaid?: boolean;
  amountReceivedDisplay?: string | null;
}

export function PaymentConfirmedOwnerEmail({
  invoiceNumber,
  clientName,
  totalDisplay,
  txid,
  mempoolUrl,
  dashboardUrl,
  underpaid,
  overpaid,
  amountReceivedDisplay,
}: PaymentConfirmedOwnerProps) {
  const label = invoiceNumber ? `Invoice ${invoiceNumber}` : "Your invoice";
  const heading = underpaid ? `Partial payment received for ${label}` : `Payment confirmed for ${label}`;
  return (
    <EmailLayout preview={heading}>
      <StatusPill status={underpaid ? "underpaid" : "paid"} />
      <EmailHeading>{heading}</EmailHeading>
      {underpaid && amountReceivedDisplay ? (
        <EmailText>
          {clientName} paid <strong>{amountReceivedDisplay}</strong> of the <strong>{totalDisplay}</strong> due on{" "}
          {label} — this does not fully cover the invoice.
        </EmailText>
      ) : (
        <EmailText>
          {clientName}&apos;s payment of <strong>{totalDisplay}</strong> for {label} is now confirmed on-chain.
        </EmailText>
      )}
      {overpaid && amountReceivedDisplay && (
        <EmailText>
          This payment overpaid the invoice: {amountReceivedDisplay} received against a {totalDisplay} total.
        </EmailText>
      )}
      <EmailButton href={dashboardUrl}>Open in SatSend</EmailButton>
      <EmailText small>
        <EmailLink href={mempoolUrl}>View transaction on mempool.space</EmailLink>
      </EmailText>
      <TxidLine txid={txid} />
    </EmailLayout>
  );
}
