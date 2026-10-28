/**
 * Sends every payment email, in every state, to one address, so they can be
 * checked in a real inbox without making payments (v1.5.28).
 *
 *   npx tsx scripts/email/send-payment-samples.tsx --to <address>
 *
 * The address is only ever taken from the command line: never write a real
 * address into this file or anywhere in the repo (a test fails if one is).
 * Uses .env.local (Resend key, sender, network); nothing is printed from it.
 * Sends 8 emails (4 states, to the client and to the sender), each subject
 * marked [Sample]. Writes nothing to the database.
 */
import { LOGO_ATTACHMENT } from "../../src/lib/email/logo-inline";
import { statusIconAttachment } from "../../src/lib/email/status-icons-inline";
import { PaymentStatusEmail } from "../../src/lib/email/templates/payment-status-email";
import { paymentState, type PaymentAudience, type PaymentSummaryInvoice } from "../../src/lib/invoices/payment-summary";

const TXID = "e2e0000000000000000000000000000000000000000000000000000000000001";
const ADDRESS = "tb1q9dx7sdre8fll42wu2aq6zm28c3refs9yst4fdt";

const PAID: PaymentSummaryInvoice = {
  status: "paid",
  pre_archive_status: null,
  overpaid: false,
  total_fiat: 100,
  currency: "USD",
  amount_received_sats: 201_500,
  amount_received_fiat: 100.75,
  payment_confirmed_at: new Date().toISOString(),
  mempool_seen_at: new Date(Date.now() - 20 * 60_000).toISOString(),
  your_company: "Maya Design Ltd",
  your_name: "Maya",
  client_company: null,
  client_name: "Acme Corp",
};

const SAMPLES: [string, PaymentSummaryInvoice][] = [
  ["Payment detected", { ...PAID, status: "payment_detected", amount_received_sats: null, amount_received_fiat: null, payment_confirmed_at: null }],
  ["Paid (with an Exchange Rate Variance)", PAID],
  ["Underpaid", { ...PAID, status: "underpaid", amount_received_sats: 123_000, amount_received_fiat: 61.5 }],
  ["Overpaid", { ...PAID, overpaid: true, amount_received_sats: 224_000, amount_received_fiat: 112 }],
];

async function main() {
  const i = process.argv.indexOf("--to");
  const to = i > 0 ? process.argv[i + 1] : undefined;
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    console.error("Usage: npx tsx scripts/email/send-payment-samples.tsx --to <address>");
    process.exit(1);
  }

  const { loadEnv } = await import("../../test-automation/lib.mjs");
  Object.assign(process.env, loadEnv());
  const { getResend, getFromAddress, getAppUrl } = await import("../../src/lib/email/client");
  const { mempoolTxUrl } = await import("../../src/lib/btc-network");
  const { render } = await import("@react-email/render");
  const resend = getResend();
  if (!resend) {
    console.error("No RESEND_API_KEY in .env.local; nothing sent.");
    process.exit(1);
  }

  for (const [label, payment] of SAMPLES) {
    for (const audience of ["client", "sender"] as PaymentAudience[]) {
      const react = PaymentStatusEmail({
        audience,
        payment,
        invoiceNumber: "INV-SAMPLE",
        btcAddress: ADDRESS,
        txid: TXID,
        mempoolUrl: mempoolTxUrl(TXID),
        actionUrl: `${getAppUrl()}/${audience === "client" ? "invoice" : "invoices"}/sample`,
      });
      const { error } = await resend.emails.send({
        from: getFromAddress(),
        to,
        subject: `[Sample] ${label}, to the ${audience}`,
        react,
        text: await render(react, { plainText: true }),
        attachments: [LOGO_ATTACHMENT, statusIconAttachment(paymentState(payment))],
      });
      console.log(error ? `failed: ${label}, to the ${audience}: ${error.message}` : `sent: ${label}, to the ${audience}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
