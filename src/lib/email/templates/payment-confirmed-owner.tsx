import { Html, Head, Body, Container, Heading, Text, Link, Section, Hr } from "@react-email/components";

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
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "system-ui, -apple-system, sans-serif", backgroundColor: "#f6f6f6", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "8px", maxWidth: "560px" }}>
          <Heading style={{ fontSize: "20px", margin: "0 0 16px" }}>
            {underpaid ? `Partial payment received for ${label}` : `Payment confirmed for ${label}`}
          </Heading>
          {underpaid && amountReceivedDisplay ? (
            <Text>{clientName} paid <strong>{amountReceivedDisplay}</strong> of the <strong>{totalDisplay}</strong> due on {label} — this does not fully cover the invoice.</Text>
          ) : (
            <Text>{clientName}&apos;s payment of <strong>{totalDisplay}</strong> for {label} is now confirmed on-chain.</Text>
          )}
          {overpaid && amountReceivedDisplay && (
            <Text>This payment overpaid the invoice: {amountReceivedDisplay} received against a {totalDisplay} total.</Text>
          )}
          <Section style={{ margin: "20px 0" }}>
            <Link href={mempoolUrl}>View transaction on mempool.space</Link>
          </Section>
          <Text style={{ fontSize: "12px", color: "#666", wordBreak: "break-all" }}>Txid: {txid}</Text>
          <Hr />
          <Section>
            <Link href={dashboardUrl}>Open in SatSend</Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
