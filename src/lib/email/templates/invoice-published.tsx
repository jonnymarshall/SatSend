import { Html, Head, Body, Container, Heading, Text, Link, Section, Hr } from "@react-email/components";

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
    <Html>
      <Head />
      <Body style={{ fontFamily: "system-ui, -apple-system, sans-serif", backgroundColor: "#f6f6f6", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "8px", maxWidth: "560px" }}>
          <Heading style={{ fontSize: "20px", margin: "0 0 16px" }}>{label} from {senderName}</Heading>
          <Text>Hi {clientName},</Text>
          <Text>{senderName} has sent you an invoice for <strong>{totalDisplay}</strong>, payable in bitcoin.</Text>
          {dueDateDisplay ? <Text>Due: {dueDateDisplay}</Text> : null}
          <Section style={{ margin: "24px 0" }}>
            <Link href={invoiceUrl} style={{ display: "inline-block", padding: "12px 20px", backgroundColor: "#DE3C4B", color: "#ffffff", borderRadius: "6px", textDecoration: "none" }}>
              View and pay
            </Link>
          </Section>
          {accessCode ? (
            <>
              <Hr />
              <Text>This invoice is protected by an access code: <strong>{accessCode}</strong></Text>
            </>
          ) : null}
          <Hr />
          <Text style={{ fontSize: "12px", color: "#666" }}>Sent via Paybitty</Text>
        </Container>
      </Body>
    </Html>
  );
}
