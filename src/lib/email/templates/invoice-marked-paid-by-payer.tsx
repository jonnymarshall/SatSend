import { Html, Head, Body, Container, Heading, Text, Link, Section, Hr } from "@react-email/components";

export interface InvoiceMarkedPaidByPayerProps {
  invoiceNumber: string | null;
  clientName: string;
  totalDisplay: string;
  currency: string;
  dashboardUrl: string;
}

export function InvoiceMarkedPaidByPayerEmail({
  invoiceNumber,
  clientName,
  totalDisplay,
  currency,
  dashboardUrl,
}: InvoiceMarkedPaidByPayerProps) {
  const label = invoiceNumber ? `invoice ${invoiceNumber}` : "your invoice";
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "system-ui, -apple-system, sans-serif", backgroundColor: "#f6f6f6", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "8px", maxWidth: "560px" }}>
          <Heading style={{ fontSize: "20px", margin: "0 0 16px" }}>
            Your client has marked {label} as paid in {currency}
          </Heading>
          <Text>
            {clientName} reported that they&apos;ve sent payment of <strong>{totalDisplay}</strong> for {label}.
            We can&apos;t verify off-chain payments automatically — please confirm receipt in your bank or wallet,
            then either confirm or dispute on the invoice page.
          </Text>
          <Hr />
          <Section>
            <Link href={dashboardUrl}>Open invoice in Paybitty</Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
