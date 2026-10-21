import type { Metadata } from "next";
import Link from "next/link";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { FAQ_GROUPS } from "@/components/marketing/faq-content";
import { FaqList } from "@/components/marketing/faq-list";
import { CONTAINER, EYEBROW, H1, LEAD, TEXT_LINK } from "@/components/marketing/styles";
import { cn } from "@/lib/utils";

/*
 * FAQ (v1.5.22, roadmap v1.5.2.3-H). All questions, grouped, with jump links;
 * the wording lives in src/components/marketing/faq-content.tsx.
 */

const TITLE = "FAQ · SatSend";
const DESCRIPTION =
  "Answers about getting started, getting paid in bitcoin, sending invoices, security and pricing.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "SatSend", images: ["/opengraph-image"] },
};

export default function FaqPage() {
  return (
    <>
      <section id="faq--intro" aria-labelledby="faq--intro--heading" className={cn(CONTAINER, "pt-14 pb-10 md:pt-24")}>
        <p className={EYEBROW}>FAQ</p>
        <h1 id="faq--intro--heading" className={cn(H1, "mt-5 max-w-[18ch]")}>
          Questions, answered.
        </h1>
        <p className={cn(LEAD, "mt-6 max-w-[52ch]")}>
          Everything about invoicing in bitcoin with SatSend: getting set up, getting paid, and what it costs.
        </p>
        <nav id="faq--jump" aria-label="Jump to a topic" className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {FAQ_GROUPS.map((group) => (
              <li key={group.id}>
                <a
                  href={`#faq--${group.id}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-(--color-border) bg-(--color-surface) px-4 text-[15px] font-medium text-(--color-ink) hover:border-(--color-border-strong) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ink)"
                >
                  {group.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <div className={cn(CONTAINER, "flex flex-col gap-16 pb-20 md:gap-20 md:pb-28")}>
        {FAQ_GROUPS.map((group) => (
          <section
            key={group.id}
            id={`faq--${group.id}`}
            aria-labelledby={`faq--${group.id}--heading`}
            className="grid scroll-mt-6 grid-cols-1 gap-6 lg:grid-cols-[1fr_1.6fr] lg:gap-16"
          >
            <h2
              id={`faq--${group.id}--heading`}
              className="font-display tracking-heading text-[26px] leading-[1.15] font-[800] md:text-[32px]"
            >
              {group.title}
            </h2>
            <FaqList items={group.items} idPrefix={`faq--${group.id}`} />
          </section>
        ))}

        <p id="faq--more" className="text-[17px] text-(--color-text-secondary)">
          Still have a question?{" "}
          <Link href="/contact" className={TEXT_LINK}>
            Contact us
          </Link>
        </p>
      </div>

      <ClosingCta idPrefix="faq" />
    </>
  );
}
