import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Mail, Wallet } from "lucide-react";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { CONTAINER, EYEBROW, H1, H2, LEAD, TEXT_LINK } from "@/components/marketing/styles";
import { cn } from "@/lib/utils";

/*
 * How it works (v1.5.18, roadmap v1.5.2.1-H). Screenshots are the real app on the
 * test database with a demo account (test-automation/demo-screens.mjs); the
 * testnet address and QR code were swapped for an unpayable example before
 * capture. Re-take them when these screens change.
 */

const TITLE = "How it works · SatSend";
const DESCRIPTION =
  "Create an invoice in your currency, send it, and your client pays in bitcoin straight to your wallet. SatSend tells you the moment it arrives.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "SatSend", images: ["/opengraph-image"] },
};

type Step = {
  id: string;
  title: string;
  intro: string;
  points: string[];
  image: { src: string; width: number; height: number; alt: string };
};

const STEPS: Step[] = [
  {
    id: "create",
    title: "Create your invoice",
    intro: "Fill in a normal invoice. It takes a couple of minutes, and SatSend remembers your own details.",
    points: [
      "Your details and your client's: names, emails, company, address, tax ID.",
      "Line items priced in your local currency, with tax and a due date.",
      "A fresh bitcoin address from your own wallet. Most wallets give you one with a tap.",
      "Optionally, an access code so only your client can open it.",
    ],
    image: {
      src: "/marketing/how-it-works/create.png",
      width: 1120,
      height: 1058,
      alt: "The invoice form: a line item for packaging design, a bitcoin address, the $960 total and the Publish button.",
    },
  },
  {
    id: "send",
    title: "Send it",
    intro: "Press Publish and SatSend emails your client a link to the invoice and a PDF copy.",
    points: [
      "Prefer to send it yourself? Copy the link and share it however you like.",
      "Your client sees who it's from, the amount and the due date, with one button to view and pay.",
    ],
    image: {
      src: "/marketing/how-it-works/send.png",
      width: 760,
      height: 574,
      alt: "The email a client receives: “Invoice INV-0043 from Maya Chen Design”, $1,380 due, and a View and pay button.",
    },
  },
  {
    id: "pay",
    title: "Your client pays",
    intro: "Your client opens the link and sees a clear invoice, with the total in your currency.",
    points: [
      "The exact bitcoin amount at the current rate, a QR code, and the address to copy.",
      "They scan the code with any bitcoin wallet and send. No account or sign-up needed.",
      "The bitcoin goes straight to your wallet. SatSend never touches it.",
    ],
    image: {
      src: "/marketing/how-it-works/pay.png",
      width: 808,
      height: 1072,
      alt: "The client's invoice page: line items, a $1,380 total, and Pay with Bitcoin showing the bitcoin amount, a QR code and the address.",
    },
  },
  {
    id: "told",
    title: "You're told",
    intro: "SatSend watches the blockchain for you, so you don't have to keep checking.",
    points: [
      "“Payment detected” within seconds of your client sending.",
      "“Paid” once the payment is confirmed, usually within about 20 minutes.",
      "An email to you at each step, and your invoice list updates on its own.",
      "If the amount is short, the invoice shows Underpaid with what arrived; overpayments are flagged too.",
    ],
    image: {
      src: "/marketing/how-it-works/paid.png",
      width: 1120,
      height: 510,
      alt: "Your invoice list: two invoices marked Paid, one Pending and one Draft.",
    },
  },
];

const CLIENT_SEES = [
  "A normal-looking invoice with your details, the line items and the total in your currency.",
  "The exact amount of bitcoin to send at today's rate, with a QR code and the address to copy.",
  "No account and no sign-up. Any bitcoin wallet works.",
  "The page updates by itself once they've paid, and they can download a PDF for their records.",
];

function Steps() {
  return (
    <ol aria-label="Steps" className="flex flex-col gap-20 md:gap-28">
      {STEPS.map((step, i) => (
        <li
          key={step.id}
          id={`how--step-${step.id}`}
          className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16"
        >
          <div className={cn("flex flex-col items-start", i % 2 === 1 && "lg:order-2")}>
            <span
              aria-hidden
              className="font-display flex size-10 items-center justify-center rounded-full bg-(--color-brand) text-lg font-[800] text-(--color-ink)"
            >
              {i + 1}
            </span>
            <h2 id={`how--step-${step.id}--heading`} className={cn(H2, "mt-5")}>
              {step.title}
            </h2>
            <p className={cn(LEAD, "mt-4 max-w-[48ch]")}>{step.intro}</p>
            <ul className="mt-6 flex flex-col gap-3">
              {step.points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-[16px] leading-[1.55]">
                  <Check aria-hidden className="mt-1 size-4 shrink-0 text-(--color-success-text)" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div
            className={cn(
              "overflow-hidden rounded-(--radius-xl) border border-(--color-border) bg-(--color-canvas) shadow-(--shadow-card)",
              i % 2 === 1 && "lg:order-1",
            )}
          >
            <Image
              src={step.image.src}
              width={step.image.width}
              height={step.image.height}
              alt={step.image.alt}
              sizes="(min-width: 1024px) 560px, 100vw"
              className="h-auto w-full"
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function ClientSees() {
  return (
    <section
      id="how--client"
      aria-labelledby="how--client--heading"
      className="rounded-(--radius-xl) border border-(--color-border) bg-(--color-surface) p-7 md:p-10"
    >
      <p className={EYEBROW}>For your client</p>
      <h2 id="how--client--heading" className="font-display tracking-heading mt-3 text-[28px] leading-[1.15] font-[800] md:text-[34px]">
        What your client sees
      </h2>
      <p className={cn(LEAD, "mt-3 max-w-[60ch]")}>
        Working with someone who&apos;s new to bitcoin? Here&apos;s what to tell them.
      </p>
      <ul className="mt-6 grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
        {CLIENT_SEES.map((line) => (
          <li key={line} className="flex items-start gap-3 text-[16px] leading-[1.55]">
            <Check aria-hidden className="mt-1 size-4 shrink-0 text-(--color-success-text)" />
            {line}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[15px] leading-[1.55] text-(--color-text-secondary)">
        All they need is a bitcoin wallet with enough bitcoin in it to cover the invoice and the usual network fee.
      </p>
    </section>
  );
}

function WhatYouNeed() {
  return (
    <section id="how--needs" aria-labelledby="how--needs--heading" className="flex flex-col items-start">
      <p className={EYEBROW}>Getting started</p>
      <h2 id="how--needs--heading" className={cn(H2, "mt-3")}>
        What you&apos;ll need
      </h2>
      <ul className="mt-8 grid w-full grid-cols-1 gap-6 md:grid-cols-2">
        <li className="flex items-start gap-4 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-6">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-(--radius-md) bg-(--color-brand-soft) text-(--color-brand-text) [&_svg]:size-5">
            <Wallet />
          </span>
          <div>
            <h3 className="text-[18px] font-semibold">A bitcoin wallet</h3>
            <p className="mt-1 text-[15px] leading-[1.55] text-(--color-text-secondary)">
              Any wallet that can give you a fresh receiving address. You keep the keys; SatSend never asks for them.
            </p>
          </div>
        </li>
        <li className="flex items-start gap-4 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-6">
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-(--radius-md) bg-(--color-brand-soft) text-(--color-brand-text) [&_svg]:size-5">
            <Mail />
          </span>
          <div>
            <h3 className="text-[18px] font-semibold">An email address</h3>
            <p className="mt-1 text-[15px] leading-[1.55] text-(--color-text-secondary)">
              That&apos;s how you sign in: we email you a link, so there&apos;s no password to remember.
            </p>
          </div>
        </li>
      </ul>
      <p className="mt-6 text-[15px] text-(--color-text-secondary)">That&apos;s all. No server, no node, no payment processor, no ID checks.</p>
      <Link id="how--needs--faq" href="/faq" className={cn(TEXT_LINK, "mt-2")}>
        Still have questions? Read the FAQ
        <ArrowRight />
      </Link>
    </section>
  );
}

export default function HowItWorksPage() {
  return (
    <>
      <section id="how--intro" aria-labelledby="how--intro--heading" className={cn(CONTAINER, "pt-14 pb-16 md:pt-24 md:pb-24")}>
        <p className={EYEBROW}>How it works</p>
        <h1 id="how--intro--heading" className={cn(H1, "mt-5 max-w-[18ch]")}>
          From invoice to bitcoin in your wallet
        </h1>
        <p className={cn(LEAD, "mt-6 max-w-[56ch]")}>
          Four steps, start to finish. You create and send the invoice; your client pays in bitcoin straight to your
          wallet; SatSend watches for the payment and tells you the moment it arrives.
        </p>
      </section>

      <div className={cn(CONTAINER, "pb-20 md:pb-28")}>
        <Steps />
      </div>

      <div className={cn(CONTAINER, "flex flex-col gap-20 pb-20 md:gap-28 md:pb-28")}>
        <ClientSees />
        <WhatYouNeed />
      </div>

      <ClosingCta idPrefix="how" />
    </>
  );
}
