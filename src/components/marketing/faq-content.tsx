import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Every FAQ answer, once (v1.5.22). The homepage shows eight of them, /pricing
 * shows the five pricing ones, and /faq shows them all, grouped; they read from
 * here so they can't drift apart. Answers are checked against the code: see the
 * v1.5.22 PR. Don't claim "open source" here until the licence is decided
 * (roadmap v1.5.2.10-H).
 */

export type FaqItem = { id: string; q: string; a: ReactNode };
export type FaqGroup = { id: string; title: string; items: FaqItem[] };

const SUPPORT = (
  <Link href="/contact" className="font-medium text-(--color-ink) underline decoration-(--color-brand) decoration-2 underline-offset-4">
    contact support
  </Link>
);

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "getting-started",
    title: "Getting started",
    items: [
      {
        id: "what-you-need",
        q: "What do I need to get started?",
        a: "A bitcoin wallet that can give you a fresh receiving address, and an email address. That's all.",
      },
      {
        id: "id-checks",
        q: "Do I need to verify my identity?",
        a: "No. There are no ID checks: sign up with your email.",
      },
      {
        id: "log-in",
        q: "How do I log in?",
        a: "We email you a sign-in link. There's no password to remember.",
      },
      {
        id: "address-types",
        q: "Which bitcoin addresses can I use?",
        a: "Any standard bitcoin address: ones starting with bc1q, bc1p, 1 or 3.",
      },
      {
        id: "new-address",
        q: "Why do I need a new bitcoin address for each invoice?",
        a: "So every payment can be matched to the right invoice and your payments stay private. Most wallets give you a fresh address with one tap.",
      },
    ],
  },
  {
    id: "getting-paid",
    title: "Getting paid",
    items: [
      {
        id: "client-account",
        q: "Does my client need a SatSend account?",
        a: "No. They open the link you send, see the amount, and pay with any bitcoin wallet by scanning the QR code.",
      },
      {
        id: "amount",
        q: "How is the bitcoin amount worked out?",
        a: "You create your invoice in your local currency. When your client opens it, SatSend shows the bitcoin amount at the current rate. Prices move, so a payment within 5% of the invoice still counts as paid in full.",
      },
      {
        id: "know-paid",
        q: "How do I know when I've been paid?",
        a: "SatSend watches the blockchain for you. The invoice updates to “Payment detected” within seconds of your client sending, then to “Paid” once it's confirmed, usually within about 20 minutes. You get an email at each step.",
      },
      {
        id: "wrong-amount",
        q: "What if my client pays the wrong amount?",
        a: "Anything within 5% of the invoice counts as paid in full. If they pay less, the invoice shows Underpaid with the amount that arrived, so you can ask for the rest. If they pay more than 5% over, it's marked as overpaid so you can settle the difference with them.",
      },
      {
        id: "instalments",
        q: "Can my client pay in instalments?",
        a: "Not yet. Ask for the full amount in one payment: an invoice is matched to a single payment.",
      },
      {
        id: "late",
        q: "What if my client pays after the due date?",
        a: "It still counts. The invoice shows Overdue until the payment arrives, then Paid.",
      },
      {
        id: "lightning",
        q: "Can my client pay with Lightning?",
        a: "Not yet. It's planned.",
      },
    ],
  },
  {
    id: "invoices",
    title: "Invoices",
    items: [
      {
        id: "send",
        q: "How do I send an invoice?",
        a: "Email it from SatSend, download the PDF, or copy the link and share it yourself.",
      },
      {
        id: "edit-after-send",
        q: "Can I change an invoice after sending it?",
        a: "No. Once it's sent, its details are fixed. Duplicate it, change the copy, and send that instead.",
      },
      {
        id: "delete-invoice",
        q: "Can I delete an invoice?",
        a: "Drafts, yes. Sent invoices can be archived instead, so your records stay complete.",
      },
      {
        id: "access-code",
        q: "What does the access code do?",
        a: "If you add one, only someone with the code can open the invoice.",
      },
      {
        id: "limit",
        q: "Is there a limit on invoices?",
        a: "No. Invoices are unlimited on both Free and Pro.",
      },
    ],
  },
  {
    id: "security",
    title: "Security and privacy",
    items: [
      {
        id: "non-custodial",
        q: "Is SatSend really non-custodial?",
        a: "Yes. Your client pays straight to a bitcoin address from your own wallet. SatSend never holds, moves or has access to your money.",
      },
      {
        id: "keys",
        q: "Will you ever ask for my keys or seed phrase?",
        a: "Never. SatSend only needs the receiving address you paste in. Anyone asking for your seed phrase is trying to steal from you.",
      },
      {
        id: "stored",
        q: "What does SatSend store?",
        a: "Your account email and your invoices: their details, line items and the receiving address you entered. Never your keys.",
      },
      {
        id: "delete-account",
        q: "Can I delete my account?",
        a: <>Yes. {SUPPORT} and we&apos;ll delete your account and your invoices.</>,
      },
    ],
  },
  {
    id: "pricing",
    title: "Pricing",
    items: [
      {
        id: "fees",
        q: "Are there any fees?",
        a: "SatSend takes no cut of your payments. Your client's wallet pays the usual bitcoin network fee when they send, and you receive the full invoice amount.",
      },
      {
        id: "pro-cost",
        q: "How much does Pro cost?",
        a: (
          <>
            $10 a month, or $100 a year (2 months free). See{" "}
            <Link href="/pricing" className="font-medium text-(--color-ink) underline decoration-(--color-brand) decoration-2 underline-offset-4">
              Pricing
            </Link>
            .
          </>
        ),
      },
      {
        id: "pay-pro",
        q: "How do I pay for Pro?",
        a: "In bitcoin, from any wallet, or by credit or debit card.",
      },
      {
        id: "renew",
        q: "Does Pro renew automatically?",
        a: "If you pay by card, Pro renews each month or year until you turn it off, which you can do at any time. If you pay in bitcoin, it doesn't renew automatically, because a bitcoin payment can't be taken without you sending it; you top up whenever you choose.",
      },
      {
        id: "pro-ends",
        q: "What happens when Pro runs out?",
        a: "You keep all your invoices, including the ones you created on Pro, and you can carry on creating new ones on Free. The Pro features switch off until you renew.",
      },
      {
        id: "refund",
        q: "Can I get a refund?",
        a: <>Yes. If you&apos;re not satisfied, ask for a refund within 15 days of paying: {SUPPORT}.</>,
      },
      {
        id: "free-forever",
        q: "Is Free really free forever?",
        a: "Yes. Creating invoices and getting paid stays free.",
      },
    ],
  },
];

const ALL = new Map(FAQ_GROUPS.flatMap((g) => g.items).map((i) => [i.id, i]));

export function faqById(id: string): FaqItem {
  const item = ALL.get(id);
  if (!item) throw new Error(`Unknown FAQ id: ${id}`);
  return item;
}

export const HOMEPAGE_FAQ: FaqItem[] = [
  "non-custodial",
  "fees",
  "client-account",
  "amount",
  "know-paid",
  "wrong-amount",
  "new-address",
  "limit",
].map(faqById);

export const PRICING_FAQ: FaqItem[] = ["pay-pro", "renew", "pro-ends", "refund", "free-forever"].map(faqById);
