import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { PRICING_FAQ } from "@/components/marketing/faq-content";
import { FaqList } from "@/components/marketing/faq-list";
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

// Order (Jonny, 2026-10-21): in both plans, then transaction fees and saved
// clients, then everything that's a cross on Free and a tick on Pro.
const COMPARISON: { feature: string; free: Cell; pro: Cell }[] = [
  { feature: "Unlimited invoices", free: true, pro: true },
  { feature: "Automatic payment detection", free: true, pro: true },
  { feature: "Invoice link and PDF", free: true, pro: true },
  { feature: "Invoices emailed to your client", free: true, pro: true },
  { feature: "Payment confirmation emails", free: true, pro: true },
  { feature: "Non-custodial: paid straight to your wallet", free: true, pro: true },
  { feature: "Transaction fees", free: "None", pro: "None" },
  { feature: "Saved clients", free: "1", pro: "Unlimited" },
  // Free emails come from "SatSend"; Pro's from your company name, replies to you.
  { feature: "Emails sent in your name", free: false, pro: true },
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
        <FaqList items={PRICING_FAQ} idPrefix="pricing--faq" />
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
