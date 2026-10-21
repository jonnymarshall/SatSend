import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ChevronDown, Code2, EyeOff, FileText, KeyRound, ShieldCheck, Timer, Wrench } from "lucide-react";
import { buttonVariants } from "@/components/signal/button";
import { BanknoteCheckIcon } from "@/components/marketing/icons";
import { InvoiceRowPreview, PaymentPreview } from "@/components/marketing/product-preview";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { CONTAINER, EYEBROW, H2, TEXT_LINK } from "@/components/marketing/styles";
import { SOCIAL_LINKS } from "@/lib/site-links";
import { cn } from "@/lib/utils";

/*
 * Homepage (v1.5.16, roadmap v1.5.2-H). Content signed off in
 * development/plans/v1.5.16-homepage-content-plan.md; change wording there first.
 */

const TITLE = "SatSend: Bitcoin invoicing, paid straight to your wallet";
const DESCRIPTION =
  "Send professional invoices your clients pay in bitcoin. Non-custodial, zero transaction fees, nothing to set up.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // Image from src/app/opengraph-image.tsx; named explicitly because this page's
  // own openGraph object replaces the inherited one.
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "SatSend", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/opengraph-image"] },
};

/* ------------------------------------------------------------------ Hero */

function Hero() {
  return (
    <section
      id="home--hero"
      aria-labelledby="home--hero--heading"
      className={cn(CONTAINER, "grid grid-cols-1 items-center gap-12 pt-14 pb-20 md:pt-24 md:pb-28 lg:grid-cols-[1.05fr_1fr] lg:gap-16")}
    >
      <div className="flex flex-col items-start">
        <p className={EYEBROW}>Bitcoin invoicing for independent professionals</p>
        <h1
          id="home--hero--heading"
          className="font-display tracking-display mt-5 text-[42px] leading-[1.04] font-[800] text-balance md:text-[64px] md:leading-[1.02]"
        >
          Invoice in bitcoin.
          <br />
          <span className="text-(--color-brand-strong)">Paid straight to your wallet.</span>
        </h1>
        <p id="home--hero--lead" className="mt-6 max-w-[46ch] text-[18px] leading-[1.55] text-(--color-text-secondary)">
          Zero transaction fees. Nothing to set up. Your client scans a QR code, the bitcoin lands in your wallet, and
          SatSend tells you the moment it arrives.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link id="home--hero--get-started" href="/signup" className={buttonVariants({ size: "lg" })}>
            Get started
            <ArrowRight />
          </Link>
          <Link id="home--hero--how-it-works" href="/how-it-works" className={buttonVariants({ size: "lg", variant: "secondary" })}>
            How it works
          </Link>
        </div>
      </div>

      <div
        id="home--hero--visual"
        role="img"
        aria-label="Example of what your client sees: a $2,500 invoice with its bitcoin amount and QR code, and the invoice marked paid in your list."
        className="relative lg:pb-16"
      >
        <PaymentPreview idPrefix="home--hero" status="payment_detected" className="lg:mr-10" />
        <InvoiceRowPreview
          idPrefix="home--hero"
          title="Brand refresh"
          client="Bright Media"
          date="3 Oct"
          fiat="$850.00"
          btc="0.01160 BTC"
          status="paid"
          className="mt-4 shadow-(--shadow-card) lg:absolute lg:right-0 lg:-bottom-2 lg:mt-0 lg:w-[86%]"
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------------- Trust strip */

const TRUST = [
  { icon: ShieldCheck, title: "Non-custodial", text: "SatSend never holds your bitcoin." },
  { icon: Wrench, title: "Nothing to set up", text: "No server, no node, no payment processor." },
  { icon: BadgeCheck, title: "No ID checks", text: "Sign up with just your email." },
];

function TrustStrip() {
  return (
    <section id="home--trust" aria-label="Why SatSend" className="border-y border-(--color-border) bg-(--color-surface)">
      <ul className={cn(CONTAINER, "grid grid-cols-1 gap-6 py-8 sm:grid-cols-3")}>
        {TRUST.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 text-(--color-brand-text) [&_svg]:size-5">
              <Icon />
            </span>
            <p className="text-[15px] leading-[1.5]">
              <strong className="font-semibold">{title}.</strong>{" "}
              <span className="text-(--color-text-secondary)">{text}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------- How it works */

const STEPS = [
  {
    title: "Create an invoice.",
    text: "Add your line items in your local currency and paste a fresh bitcoin address from your wallet.",
  },
  {
    title: "Send it to your client.",
    text: "SatSend emails them a link and a PDF, or you share the link yourself.",
  },
  {
    title: "Get paid.",
    text: "Your client scans the QR code and pays from any bitcoin wallet. The bitcoin goes straight to you, and SatSend emails you the moment it arrives.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="home--how--heading" className={cn(CONTAINER, "scroll-mt-6 py-20 md:py-28")}>
      <p className={EYEBROW}>How it works</p>
      <h2 id="home--how--heading" className={cn(H2, "mt-4 max-w-[20ch]")}>
        From invoice to bitcoin in three steps.
      </h2>
      <ol className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            id={`home--how--step-${i + 1}`}
            className="rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-6"
          >
            <span
              aria-hidden
              className="font-display flex size-10 items-center justify-center rounded-full bg-(--color-brand) text-lg font-[800] text-(--color-ink)"
            >
              {i + 1}
            </span>
            <h3 className="mt-5 text-[18px] font-semibold">{step.title}</h3>
            <p className="mt-2 text-[15px] leading-[1.55] text-(--color-text-secondary)">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ----------------------------------------------------------- Highlights */

const HIGHLIGHTS = [
  {
    icon: FileText,
    title: "An invoice that looks the part",
    text: "A clean payment page and a PDF, not a bare address pasted into an email. Your client sees exactly what they owe and how to pay.",
  },
  {
    icon: BanknoteCheckIcon,
    title: "The right amount of bitcoin, every time",
    text: "You invoice in your local currency; your client sees the bitcoin amount at the current rate when they open it.",
  },
  {
    icon: Timer,
    title: "Know the moment you're paid",
    text: "SatSend watches the blockchain for you. The invoice moves to “Payment detected” within seconds, then to “Paid” once confirmed, and you get an email at each step.",
  },
  {
    icon: KeyRound,
    title: "Non-custodial by design",
    text: "Payments go from your client's wallet straight to yours. SatSend never holds, moves or has access to your money.",
  },
  {
    icon: EyeOff,
    title: "Secure and private invoices",
    text: "Add an access code so only your client can open the invoice.",
  },
  {
    icon: Code2,
    title: "Fully open source",
    text: "Every line of SatSend's code is public on GitHub, so anyone can audit exactly how it handles your invoices and payments. Don't trust, verify.",
    link: { label: "View the code", href: SOCIAL_LINKS.github },
  },
];

function Highlights() {
  return (
    <section id="home--highlights" aria-labelledby="home--highlights--heading" className="bg-(--color-surface) border-y border-(--color-border)">
      <div className={cn(CONTAINER, "py-20 md:py-28")}>
        <p className={EYEBROW}>Why SatSend</p>
        <h2 id="home--highlights--heading" className={cn(H2, "mt-4 max-w-[22ch]")}>
          Better than pasting an address into an email.
        </h2>
        <ul className="mt-12 grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map(({ icon: Icon, title, text, link }, i) => (
            <li key={title} id={`home--highlights--item-${i + 1}`} className="flex flex-col items-start">
              <span
                aria-hidden
                className="flex size-11 items-center justify-center rounded-(--radius-md) bg-(--color-brand-soft) text-(--color-brand-text) [&_svg]:size-5"
              >
                <Icon />
              </span>
              <h3 className="mt-4 text-[18px] font-semibold">{title}</h3>
              <p className="mt-2 text-[15px] leading-[1.55] text-(--color-text-secondary)">{text}</p>
              {link ? (
                <Link href={link.href} className={cn(TEXT_LINK, "mt-1 text-[15px]")}>
                  {link.label}
                  <ArrowRight />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Pricing */

function Pricing() {
  return (
    <section id="home--pricing" aria-labelledby="home--pricing--heading" className={cn(CONTAINER, "py-20 md:py-28")}>
      <div className="flex flex-col items-center text-center">
        <p className={EYEBROW}>Pricing</p>
        <h2 id="home--pricing--heading" className={cn(H2, "mt-4")}>
          Simple pricing.
        </h2>
        <p className="mt-4 max-w-[52ch] text-[18px] leading-[1.55] text-(--color-text-secondary)">
          SatSend never takes a cut of your payments, on either plan.
        </p>
      </div>
      <div className="mt-10">
        <PricingPlans idPrefix="home--pricing" />
      </div>
      <div className="mt-6 flex justify-center">
        <Link id="home--pricing--more" href="/pricing" className={TEXT_LINK}>
          See full pricing
          <ArrowRight />
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ FAQ */

const FAQ = [
  {
    q: "Is SatSend really non-custodial?",
    a: "Yes. Your client pays straight to a bitcoin address from your own wallet. SatSend never holds, moves or has access to your money.",
  },
  {
    q: "Are there any fees?",
    a: "SatSend takes no cut of your payments. Your client's wallet pays the usual bitcoin network fee when they send, and you receive the full invoice amount.",
  },
  {
    q: "Does my client need a SatSend account?",
    a: "No. They open the link you send, see the amount, and pay with any bitcoin wallet by scanning the QR code.",
  },
  {
    q: "How is the bitcoin amount worked out?",
    a: "You create your invoice in your local currency. When your client opens it, SatSend shows the bitcoin amount at the current rate. Prices move, so a payment within 5% of the invoice still counts as paid in full.",
  },
  {
    q: "How do I know when I've been paid?",
    a: "SatSend watches the blockchain for you. The invoice updates to “Payment detected” within seconds of your client sending, then to “Paid” once it's confirmed, usually within about 20 minutes. You get an email at each step.",
  },
  {
    q: "What if my client pays the wrong amount?",
    a: "Anything within 5% of the invoice counts as paid in full. If they pay less, the invoice shows Underpaid with the amount that arrived, so you can ask for the rest. If they pay more than 5% over, it's marked as overpaid so you can settle the difference with them.",
  },
  {
    q: "Why do I need a new bitcoin address for each invoice?",
    a: "So every payment can be matched to the right invoice and your payments stay private. Most wallets give you a fresh address with one tap.",
  },
  {
    q: "Is there a limit on invoices?",
    a: "No. Invoices are unlimited on both Free and Pro.",
  },
];

function Faq() {
  return (
    <section id="home--faq" aria-labelledby="home--faq--heading" className="border-t border-(--color-border) bg-(--color-surface)">
      <div className={cn(CONTAINER, "grid grid-cols-1 gap-10 py-20 md:py-28 lg:grid-cols-[1fr_1.6fr] lg:gap-16")}>
        <div>
          <p className={EYEBROW}>FAQ</p>
          <h2 id="home--faq--heading" className={cn(H2, "mt-4")}>
            Questions, answered.
          </h2>
          <Link id="home--faq--more" href="/faq" className={cn(TEXT_LINK, "mt-6")}>
            See all questions
            <ArrowRight />
          </Link>
        </div>
        <div className="divide-y divide-(--color-border) border-y border-(--color-border)">
          {FAQ.map(({ q, a }, i) => (
            <details key={q} id={`home--faq--item-${i + 1}`} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[17px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ink) [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown aria-hidden className="size-5 shrink-0 text-(--color-text-secondary) transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-5 text-[15px] leading-[1.6] text-(--color-text-secondary)">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <Highlights />
      <Pricing />
      <Faq />
      <ClosingCta idPrefix="home" />
    </>
  );
}
