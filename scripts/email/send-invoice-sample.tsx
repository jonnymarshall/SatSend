/**
 * Sends sample copies of the email a client receives with an invoice
 * (v1.5.36, roadmap v1.4.26), so its wording can be read in a real inbox.
 *
 *   npx tsx scripts/email/send-invoice-sample.tsx --to <address>
 *
 * Two samples: with and without an access code. Subjects start "[Sample]".
 * Uses .env.local (Resend key, sender); nothing is printed from it.
 * The address is only ever typed on the command line: never put it in a file.
 */
import { LOGO_ATTACHMENT } from "../../src/lib/email/logo-inline";
import { InvoicePublishedEmail } from "../../src/lib/email/templates/invoice-published";

async function main() {
  const i = process.argv.indexOf("--to");
  const to = i > 0 ? process.argv[i + 1] : undefined;
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    console.error("Usage: npx tsx scripts/email/send-invoice-sample.tsx --to <address>");
    process.exit(1);
  }

  const { loadEnv } = await import("../../test-automation/lib.mjs");
  Object.assign(process.env, loadEnv());
  const { getResend, getFromAddress, getAppUrl } = await import("../../src/lib/email/client");
  const { render } = await import("@react-email/render");
  const resend = getResend();
  if (!resend) {
    console.error("No RESEND_API_KEY in .env.local; nothing sent.");
    process.exit(1);
  }

  const senderName = "Maya Chen";
  const totalDisplay = "$1,380.00";
  for (const [label, accessCode] of [
    ["without an access code", null],
    ["with an access code", "SECRET42"],
  ] as const) {
    const react = InvoicePublishedEmail({
      senderName,
      clientName: "Priya",
      invoiceNumber: "INV-0043",
      reference: "7K3QX9AB",
      totalDisplay,
      invoiceUrl: `${getAppUrl()}/invoice/ss-7k3qx9ab`,
      accessCode,
      dueDateDisplay: "December 1, 2026",
    });
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: `[Sample] ${senderName} sent you an invoice for ${totalDisplay} (${label})`,
      react,
      text: await render(react, { plainText: true }),
      attachments: [LOGO_ATTACHMENT],
    });
    console.log(error ? `failed (${label}): ${error.message}` : `sent (${label})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
