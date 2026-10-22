import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { SOURCE_AVAILABLE } from "@/components/marketing/faq-content";
import { CONTAINER, EYEBROW, H1, LEAD, TEXT_LINK } from "@/components/marketing/styles";
import { SOCIAL_LINKS } from "@/lib/site-links";
import { cn } from "@/lib/utils";

/*
 * Security (v1.5.25, roadmap v1.5.2.4-H). Every claim here is checked against the
 * code: see the v1.5.25 PR. The licence wording is shared with the FAQ
 * (SOURCE_AVAILABLE) so the two can't drift. Never "open source" (v1.5.23), and never
 * explain bitcoin networks to users: that's for development only (Jonny,
 * 2026-10-21). Access codes stay broad: no guess counts (roadmap v1.5.2.12-H).
 */

const TITLE = "Security · SatSend";
const DESCRIPTION =
  "SatSend never holds your bitcoin. What it stores, what it can never do, how your receiving address is protected, and how to audit the code.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "SatSend", images: ["/opengraph-image"] },
};

const HEADING = "font-display tracking-heading text-[26px] leading-[1.15] font-[800] md:text-[32px]";
const BODY = "text-[17px] leading-[1.6] text-(--color-text-secondary)";
const INLINE_LINK = "font-medium text-(--color-ink) underline decoration-(--color-brand) decoration-2 underline-offset-4";

// Short labels for the topic buttons under the heading, as on /faq.
const TOPICS = [
  { id: "custody", label: "Your bitcoin" },
  { id: "stored", label: "What we store" },
  { id: "address", label: "Your address" },
  { id: "access-codes", label: "Access codes" },
  { id: "audit", label: "Audit the code" },
  { id: "report", label: "Report a problem" },
];

// The minimum: everything else on an invoice is optional (src/lib/invoices/schema.ts).
const STORED = [
  "Your account email",
  "Your invoices: their amounts, line items and the receiving address you entered",
];

const NEVER = [
  "Hold, move or spend your bitcoin",
  "Ask for your keys or seed phrase",
  "Take a cut of your payments",
  "See your wallet balance",
];

const ADDRESS = [
  "Every address is checked when you enter it, so a mistyped one is caught before you can send the invoice.",
  "An address can only be used on one invoice, so every payment matches the right invoice.",
  "Once an invoice is sent, its details are fixed, including the address, so it can't be swapped for another one.",
];

// btc-qr-code.tsx draws it in the payer's browser from buildBip21Uri(invoice.btc_address, ...);
// qrcode is pinned and checked by src/qrcode-pinned.test.ts.
const QR = [
  "Your client's own browser draws the QR code when they open the invoice, from the address saved on it and the amount due. It's a standard bitcoin payment request that any wallet can read.",
  "No outside QR service is involved, so no other website ever sees or handles your address.",
  "The software that draws it is locked to one checked version and is only ever updated deliberately, never automatically, so a tampered update can't slip in.",
  "The address is also printed in full next to the QR code, so your client can check their wallet shows the same one before they pay.",
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      id={`security--${id}`}
      aria-labelledby={`security--${id}--heading`}
      className="grid scroll-mt-6 grid-cols-1 gap-6 lg:grid-cols-[1fr_1.6fr] lg:gap-16"
    >
      <h2 id={`security--${id}--heading`} className={HEADING}>
        {title}
      </h2>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

function List({ id, items, icon }: { id: string; items: string[]; icon: "check" | "cross" }) {
  const Icon = icon === "check" ? Check : X;
  return (
    <ul id={id} className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-[16px] leading-[1.55]">
          <Icon
            aria-hidden
            className={cn(
              "mt-1 size-4 shrink-0",
              icon === "check" ? "text-(--color-success-text)" : "text-(--color-text-secondary)",
            )}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function SecurityPage() {
  return (
    <>
      <section id="security--intro" aria-labelledby="security--intro--heading" className={cn(CONTAINER, "pt-14 pb-10 md:pt-24")}>
        <p className={EYEBROW}>Security</p>
        <h1 id="security--intro--heading" className={cn(H1, "mt-5 max-w-[18ch]")}>
          Your bitcoin stays yours.
        </h1>
        <p className={cn(LEAD, "mt-6 max-w-[52ch]")}>
          SatSend sends the invoice and watches for the payment. Your client pays straight to your wallet, so there&apos;s
          nothing of yours here for anyone to take.
        </p>
        <nav id="security--jump" aria-label="Jump to a topic" className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => (
              <li key={topic.id}>
                <a
                  href={`#security--${topic.id}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-(--color-border) bg-(--color-surface) px-4 text-[15px] font-medium text-(--color-ink) hover:border-(--color-border-strong) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ink)"
                >
                  {topic.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <div className={cn(CONTAINER, "flex flex-col gap-16 pb-20 md:gap-20 md:pb-28")}>
        <Section id="custody" title="Your bitcoin never touches SatSend">
          <p className={BODY}>
            SatSend is non-custodial. You give it a receiving address from your own wallet, and your client pays to that
            address directly. SatSend never holds, moves or has access to your money, and it can&apos;t freeze or delay a
            payment.
          </p>
          <p className={BODY}>
            We will never ask for your keys or seed phrase. Anyone who does, whatever they say, is trying to steal from
            you.
          </p>
        </Section>

        <Section id="stored" title="What we store, and what we'll never do">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-[18px] font-semibold">What SatSend stores</h3>
              <p className="mt-1 text-[15px] text-(--color-text-secondary)">At a minimum:</p>
              <div className="mt-4">
                <List id="security--stored--list" items={STORED} icon="check" />
              </div>
              <p id="security--stored--optional" className="mt-4 text-[15px] leading-[1.55] text-(--color-text-secondary)">
                Plus anything else you choose to add, such as your name, company, address or tax ID, and your
                client&apos;s details.
              </p>
            </div>
            <div>
              <h3 className="text-[18px] font-semibold">What SatSend will never do</h3>
              <div className="mt-4">
                <List id="security--never--list" items={NEVER} icon="cross" />
              </div>
            </div>
          </div>
          <p className={BODY}>
            You sign in with a link we email you, so there&apos;s no password to leak. Other SatSend users can never see
            your invoices; only you, and whoever you send an invoice&apos;s link to.
          </p>
        </Section>

        <Section id="address" title="Your receiving address is protected">
          <p className={BODY}>The address is the one thing that decides where the money goes, so SatSend guards it closely.</p>
          <List id="security--address--list" items={ADDRESS} icon="check" />
          <h3 id="security--qr--heading" className="mt-4 text-[18px] font-semibold">
            How the QR code is made
          </h3>
          <List id="security--qr--list" items={QR} icon="check" />
        </Section>

        <Section id="access-codes" title="Access codes">
          <p className={BODY}>
            Each invoice link contains a long random ID, so nobody can find it by guessing. For extra privacy, add an
            access code when you create the invoice: only someone with the code can open it. When you email the invoice from
            SatSend, the code goes in the email so your client has it.
          </p>
        </Section>

        <Section id="audit" title="Audit the code yourself">
          <p className={BODY}>{SOURCE_AVAILABLE}</p>
          <p className={BODY}>
            You don&apos;t have to take our word for anything on this page: you, or anyone you trust, can check how SatSend
            handles your address, your invoices and your payments. Don&apos;t trust, verify.
          </p>
          <Link id="security--audit--code" href={SOCIAL_LINKS.github} className={cn(TEXT_LINK, "self-start")}>
            View the code
            <ArrowRight />
          </Link>
        </Section>

        <Section id="report" title="Found a problem?">
          <p className={BODY}>
            If you think you&apos;ve found a security problem,{" "}
            <Link id="security--report--contact" href="/contact" className={INLINE_LINK}>
              contact us
            </Link>{" "}
            and we&apos;ll look into it straight away. For anything that isn&apos;t urgent, you can also{" "}
            <Link id="security--report--issue" href={SOCIAL_LINKS.github} className={INLINE_LINK}>
              open an issue on GitHub
            </Link>
            .
          </p>
        </Section>
      </div>

      <ClosingCta idPrefix="security" />
    </>
  );
}
