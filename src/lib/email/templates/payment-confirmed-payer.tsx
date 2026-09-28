import { Html, Head, Body, Container, Heading, Text, Link, Section, Hr } from "@react-email/components";

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
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "system-ui, -apple-system, sans-serif", backgroundColor: "#f6f6f6", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "8px", maxWidth: "560px" }}>
          <Heading style={{ fontSize: "20px", margin: "0 0 16px" }}>
            {underpaid ? "Your partial payment was received" : "Your payment is confirmed"}
          </Heading>
          {underpaid && amountReceivedDisplay ? (
            <Text>We received <strong>{amountReceivedDisplay}</strong> of the <strong>{totalDisplay}</strong> due to {senderName} for {label} — this does not fully cover the invoice. Please reach out to {senderName} about the remaining balance.</Text>
          ) : (
            <Text>Your payment of <strong>{totalDisplay}</strong> to {senderName} for {label} is now confirmed on-chain. Thanks!</Text>
          )}
          {overpaid && amountReceivedDisplay && (
            <Text>Your payment overpaid the invoice: {amountReceivedDisplay} sent against a {totalDisplay} total.</Text>
          )}
          <Section style={{ margin: "20px 0" }}>
            <Link href={mempoolUrl}>View transaction on mempool.space</Link>
          </Section>
          <Text style={{ fontSize: "12px", color: "#666", wordBreak: "break-all" }}>Txid: {txid}</Text>
          <Hr />
          <Section>
            <Link href={invoiceUrl}>View invoice</Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
