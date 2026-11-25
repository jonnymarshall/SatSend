import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import { InvoicePublishedEmail, type InvoicePublishedProps } from "./invoice-published";

// v1.5.36 (roadmap v1.4.26): the email a client receives with an invoice.
// The subject carries who and how much; the heading is the invoice number; a
// short "How to pay" explains bitcoin payment without the client having to
// click through first.

function props(over: Partial<InvoicePublishedProps> = {}): InvoicePublishedProps {
  return {
    senderName: "Maya Chen",
    clientName: "Priya",
    invoiceNumber: "INV-001",
    reference: "7K3QX9AB",
    totalDisplay: "$1,380.00",
    invoiceUrl: "https://satsend.me/invoice/ss-7k3qx9ab",
    accessCode: null,
    dueDateDisplay: "December 1, 2026",
    ...over,
  };
}

async function plain(p: InvoicePublishedProps) {
  return render(<InvoicePublishedEmail {...p} />, { plainText: true });
}

describe("InvoicePublishedEmail", () => {
  it("heads with the invoice number, not a repeat of the subject", async () => {
    const text = await plain(props());
    expect(text).toMatch(/INVOICE INV-001|Invoice INV-001/);
    expect(text).not.toMatch(/Invoice INV-001 from Maya Chen/);
  });

  it("an invoice without a number is headed 'Your invoice'", async () => {
    const text = await plain(props({ invoiceNumber: null }));
    expect(text).toMatch(/YOUR INVOICE|Your invoice/);
  });

  it("greets the client by name and says who sent what", async () => {
    const text = await plain(props());
    expect(text).toContain("Hi Priya,");
    expect(text).toContain("Maya Chen has sent you an invoice for $1,380.00, payable in bitcoin.");
  });

  it("explains how to pay in three steps, with the rate rule", async () => {
    const text = await plain(props());
    expect(text).toMatch(/How to pay/i);
    expect(text).toContain("Open the invoice with the button below.");
    expect(text).toContain("Send the exact bitcoin amount shown, from any bitcoin wallet, to the address on the page.");
    expect(text).toContain("You and Maya Chen will both get an email when the payment arrives.");
    expect(text).toContain("The bitcoin amount is worked out at the current rate when you open the invoice.");
  });

  it("never suggests SatSend holds or receives the money", async () => {
    const text = (await plain(props())).toLowerCase();
    expect(text).not.toMatch(/we receive|we've received|we hold|satsend receives|pay satsend/);
    expect(text).toContain("goes straight to maya chen");
  });

  it("an access code is mentioned in the first step when there is one", async () => {
    const text = await plain(props({ accessCode: "SECRET42" }));
    expect(text).toContain("Open the invoice with the button below and enter the access code.");
  });
});
