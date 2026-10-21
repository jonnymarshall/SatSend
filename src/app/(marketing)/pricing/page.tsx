import type { Metadata } from "next";
import Link from "next/link";
import { Check, ChevronDown, X } from "lucide-react";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { CONTAINER, EYEBROW, H1, H2, LEAD } from "@/components/marketing/styles";
import { cn } from "@/lib/utils";

/*
 * Pricing (v1.5.21, roadmap v1.5.2.2-H). The cards are shared with the homepage
 * (PricingPlans). The comparison lists only what's planned for launch; later
 * Pro features (reports, API) are added when they're built (Jonny, 2026-10-21).
 */

const TITLE = "Pricing · SatSend";
const DESCRIPTION =
  "Free for unlimited bitcoin invoices. Pro is $10 a month, or $100 a year, for your own link, client pages, branding and reminders.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "SatSend", images: ["/opengraph-image"] },
};

type Cell = true | false | string;

// Order (Jonny, 2026-10-21): in both plans, then transaction fees, then emails in
// your name, then saved clients, then Pro only. Ticks and crosses, not wording.
const COMPARISON: { feature: string; free: Cell; pro: Cell }[] = [
  { feature: "Unlimited invoices", free: true, pro: true },
  { feature: "Automatic payment detection", free: true, pro: true },
  { feature: "Invoice link and PDF", free: true, pro: true },
  { feature: "Invoices emailed to your client", free: true, pro: true },
  { feature: "Payment confirmation emails", free: true, pro: true },
  { feature: "Non-custodial: paid straight to your wallet", free: true, pro: true },
  { feature: "Transaction fees", free: "None", pro: "None" },
  // Free emails come from "SatSend"; Pro's from your company name, replies to you.
  { feature: "Emails sent in your name", free: false, pro: true },
  { feature: "Saved clients", free: "1", pro: "Unlimited" },
  { feature: "Reusable line items", free: false, pro: true },
  { feature: "Your own link: satsend.me/yourname", free: false, pro: true },
  { feature: "Client pages: all of a client's invoices in one place", free: false, pro: true },
  { feature: "Your logo and colours on invoices, PDFs and emails", free: false, pro: true },
  { feature: "Automatic payment reminders", free: false, pro: true },
];

function CellValue({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <>
        <Check aria-hidden className="mx-auto size-5 text-(--color-success-text)" />
        <span className="sr-only">Included</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <X aria-hidden className="mx-auto size-5 text-(--color-text-secondary)" />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  return <span className="text-[14px] leading-[1.4]">{value}</span>;
}

function Comparison() {
  return (
    <section id="pricing--compare" aria-labelledby="pricing--compare--heading" className={cn(CONTAINER, "py-20 md:py-28")}>
      <h2 id="pricing--compare--heading" className={cn(H2, "text-center")}>
        Compare plans
      </h2>
      <div className="mx-auto mt-10 max-w-[920px] overflow-hidden rounded-(--radius-xl) border border-(--color-border) bg-(--color-surface)">
        <table id="pricing--compare--table" aria-labelledby="pricing--compare--heading" className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-(--color-border) text-[14px]">
              <th scope="col" className="w-[46%] px-4 py-4 font-semibold sm:px-6">
                Feature
              </th>
              <th scope="col" className="px-2 py-4 text-center font-semibold">
                Free
              </th>
              <th scope="col" className="px-2 py-4 text-center font-semibold">
                Pro
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.feature} className="border-b border-(--color-border) last:border-b-0">
                <th scope="row" className="px-4 py-3.5 text-[15px] leading-[1.45] font-normal sm:px-6">
                  {row.feature}
                </th>
                <td className="px-2 py-3.5 text-center text-(--color-text-secondary)">
                  <CellValue value={row.free} />
                </td>
                <td className="px-2 py-3.5 text-center text-(--color-text-secondary)">
                  <CellValue value={row.pro} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "How do I pay for Pro?",
    a: "In bitcoin, from any wallet, or by credit or debit card.",
  },
  {
    q: "Does Pro renew automatically?",
    a: "If you pay by card, Pro renews each month or year until you turn it off, which you can do at any time. If you pay in bitcoin, it doesn't renew automatically, because a bitcoin payment can't be taken without you sending it; you top up whenever you choose.",
  },
  {
    q: "What happens when Pro runs out?",
    a: "You keep all your invoices, including the ones you created on Pro, and you can carry on creating new ones on Free. The Pro features switch off until you renew.",
  },
  {
    q: "Can I get a refund?",
    a: (
      <>
        Yes. If you&apos;re not satisfied, ask for a refund within 15 days of paying:{" "}
        <Link href="/contact" className="font-medium text-(--color-ink) underline decoration-(--color-brand) decoration-2 underline-offset-4">
          contact support
        </Link>
        .
      </>
    ),
  },
  {
    q: "Is Free really free forever?",
    a: "Yes. Creating invoices and getting paid stays free.",
  },
];

function PricingFaq() {
  return (
    <section id="pricing--faq" aria-labelledby="pricing--faq--heading" className="border-t border-(--color-border) bg-(--color-surface)">
      <div className={cn(CONTAINER, "grid grid-cols-1 gap-10 py-20 md:py-28 lg:grid-cols-[1fr_1.6fr] lg:gap-16")}>
        <div>
          <p className={EYEBROW}>FAQ</p>
          <h2 id="pricing--faq--heading" className={cn(H2, "mt-4")}>
            Pricing questions
          </h2>
        </div>
        <div className="divide-y divide-(--color-border) border-y border-(--color-border)">
          {FAQ.map(({ q, a }, i) => (
            <details key={q} id={`pricing--faq--item-${i + 1}`} className="group">
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

export default function PricingPage() {
  return (
    <>
      <section id="pricing--intro" aria-labelledby="pricing--intro--heading" className={cn(CONTAINER, "pt-14 pb-12 text-center md:pt-24")}>
        <p className={EYEBROW}>Pricing</p>
        <h1 id="pricing--intro--heading" className={cn(H1, "mx-auto mt-5 max-w-[16ch]")}>
          Simple pricing. No cut of your payments.
        </h1>
        <p className={cn(LEAD, "mx-auto mt-6 max-w-[52ch]")}>
          Invoicing in bitcoin is free, with unlimited invoices. Pro adds the polish: your own link, client pages, your
          branding and automatic reminders.
        </p>
      </section>

      <div className={cn(CONTAINER, "pb-4")}>
        <PricingPlans idPrefix="pricing" />
      </div>

      <Comparison />
      <PricingFaq />
      <ClosingCta idPrefix="pricing" />
    </>
  );
}
