import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { CONTAINER, EYEBROW, H1, LEAD } from "@/components/marketing/styles";
import { slippageToleranceFiat } from "@/lib/invoices/payment-schedule";
import { cn } from "@/lib/utils";

/*
 * How payments are settled (v1.5.29, roadmap v1.5.2.22-H). Explains, for the
 * client paying and the person who sent the invoice, how a payment is judged:
 * the held amount (locked quote), the Slippage Tolerance, the Settlement
 * Variance, underpaid and overpaid, and paying without a held amount. Jonny's
 * terms (2026-10-28): always "Slippage Tolerance" and "Settlement Variance".
 * Every number is checked against the code by the page's test. Never say SatSend
 * received or holds a payment: it never does.
 */

const TITLE = "How payments are settled · SatSend";
const DESCRIPTION =
  "How SatSend decides whether an invoice is paid in full: the bitcoin amount held for 30 minutes, the Slippage Tolerance, Settlement Variance, and what happens if a payment is short or over.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "SatSend", images: ["/opengraph-image"] },
};

const HEADING = "font-display tracking-heading text-[26px] leading-[1.15] font-[800] md:text-[32px]";
const BODY = "text-[17px] leading-[1.6] text-(--color-text-secondary)";
const INLINE_LINK = "font-medium text-(--color-ink) underline decoration-(--color-brand) decoration-2 underline-offset-4";
const CARD = "rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-6";

const TOPICS = [
  { id: "in-short", label: "In short" },
  { id: "held-amount", label: "The held amount" },
  { id: "slippage-tolerance", label: "Slippage Tolerance" },
  { id: "settlement-variance", label: "Settlement Variance" },
  { id: "short-or-over", label: "Underpaid or overpaid" },
  { id: "no-held-amount", label: "Paying later" },
  { id: "confirmation", label: "When it counts" },
];

// Worked out from the same function that judges payments, so they can't drift.
const EXAMPLES = [100, 1_000, 2_500, 8_000];

function usd(amount: number, cents = true) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(amount);
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      id={`settlement--${id}`}
      aria-labelledby={`settlement--${id}--heading`}
      className="grid scroll-mt-6 grid-cols-1 gap-6 lg:grid-cols-[1fr_1.6fr] lg:gap-16"
    >
      <h2 id={`settlement--${id}--heading`} className={HEADING}>
        {title}
      </h2>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  );
}

/** A small receipt-style box, like the one on a paid invoice. */
function Sums({ id, rows }: { id: string; rows: [string, string, boolean?][] }) {
  return (
    <div id={id} className="max-w-sm space-y-2 rounded-(--radius-md) bg-(--color-neutral-soft) p-4 text-[15px]">
      {rows.map(([label, value, total]) => (
        <div
          key={label}
          className={cn("flex justify-between gap-3", total && "border-t border-(--color-ink)/10 pt-2 font-semibold")}
        >
          <span className={total ? undefined : "text-(--color-ink)/70"}>{label}</span>
          <span className="tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function PaymentSettlementPage() {
  return (
    <>
      <section id="settlement--intro" aria-labelledby="settlement--intro--heading" className={cn(CONTAINER, "pt-14 pb-10 md:pt-24")}>
        <p className={EYEBROW}>Payment settlement</p>
        <h1 id="settlement--intro--heading" className={cn(H1, "mt-5 max-w-[20ch]")}>
          How payments are settled
        </h1>
        <p className={cn(LEAD, "mt-6 max-w-[56ch]")}>
          Invoices are priced in your local currency and paid in bitcoin. Here&apos;s how SatSend decides whether a
          payment covers the invoice, and what happens when it doesn&apos;t quite.
        </p>
        <nav id="settlement--jump" aria-label="Jump to a topic" className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => (
              <li key={topic.id}>
                <a
                  href={`#settlement--${topic.id}`}
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
        <Section id="in-short" title="In short">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div id="settlement--in-short--client" className={CARD}>
              <h3 className="text-[18px] font-semibold">If you&apos;re paying an invoice</h3>
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[16px] leading-[1.55] text-(--color-text-secondary)">
                <li>Click Pay now in Bitcoin and send the exact amount shown, within 30 minutes.</li>
                <li>A small difference, such as a wallet fee, still counts as paid in full.</li>
                <li>If the invoice says Underpaid or Overpaid, contact whoever sent it to settle the difference.</li>
              </ul>
            </div>
            <div id="settlement--in-short--sender" className={CARD}>
              <h3 className="text-[18px] font-semibold">If you sent the invoice</h3>
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[16px] leading-[1.55] text-(--color-text-secondary)">
                <li>A change in the bitcoin price while your client pays doesn&apos;t count against either of you.</li>
                <li>A payment within 1% of the total (up to $25) counts as paid in full.</li>
                <li>
                  Anything further out shows as Underpaid or Overpaid, with the difference, so you can settle it with
                  your client.
                </li>
              </ul>
            </div>
          </div>
          <p className={BODY}>
            Either way, the bitcoin goes straight from your client&apos;s wallet to the sender&apos;s. SatSend never holds
            the money; it watches the blockchain and tells you both what arrived.
          </p>
        </Section>

        <Section id="held-amount" title="The bitcoin amount is held for 30 minutes">
          <p className={BODY}>
            When your client clicks <strong className="text-(--color-ink)">Pay now in Bitcoin</strong>, SatSend works out
            the bitcoin amount at the current exchange rate and holds it for 30 minutes. That&apos;s the amount in the QR
            code, and the page shows the time it&apos;s held until.
          </p>
          <p className={BODY}>
            A payment made in that time is checked against exactly that bitcoin amount. So if the bitcoin price moves
            between paying and the payment confirming, it doesn&apos;t matter: paying the amount shown always settles the
            invoice in full.
          </p>
          <p className={BODY}>After 30 minutes, the page shows a fresh amount at the new rate.</p>
        </Section>

        <Section id="slippage-tolerance" title="Slippage Tolerance">
          <p className={BODY}>
            A payment doesn&apos;t always arrive to the exact amount. Some wallets and exchanges take their fee out of what
            they send, and some round the amount. So a payment within a small margin of the invoice still counts as paid
            in full. That margin is the <strong className="text-(--color-ink)">Slippage Tolerance</strong>: 1% of the
            invoice total, up to $25, either way.
          </p>
          <table id="settlement--slippage-tolerance--examples" className="w-full max-w-sm text-left text-[15px]">
            <thead>
              <tr className="border-b border-(--color-border) text-(--color-text-secondary)">
                <th scope="col" className="py-2 font-medium">Invoice total</th>
                <th scope="col" className="py-2 text-right font-medium">Slippage Tolerance</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLES.map((total) => (
                <tr key={total} className="border-b border-(--color-border)">
                  <td className="py-2 tabular-nums">{usd(total, false)}</td>
                  <td className="py-2 text-right tabular-nums">{usd(slippageToleranceFiat(total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section id="settlement-variance" title="Settlement Variance">
          <p className={BODY}>
            When a payment is within the Slippage Tolerance but not exact, the invoice shows the difference as a{" "}
            <strong className="text-(--color-ink)">Settlement Variance</strong>. It&apos;s there so the sums add up: the
            invoice is paid in full and nothing is outstanding, in either direction.
          </p>
          <Sums
            id="settlement--settlement-variance--example"
            rows={[
              ["Requested", "$100.00"],
              ["Received", "$99.40"],
              ["Settlement Variance", "−$0.60"],
              ["Outstanding", "$0.00", true],
            ]}
          />
        </Section>

        <Section id="short-or-over" title="If a payment is underpaid or overpaid">
          <p className={BODY}>
            <strong className="text-(--color-ink)">Underpaid:</strong>{" "}a payment short by more than the Slippage
            Tolerance. The invoice shows what arrived and what&apos;s still outstanding. The client should contact the
            sender to settle the rest. If the sender settles it some other way, they can mark the invoice as paid.
          </p>
          <p className={BODY}>
            <strong className="text-(--color-ink)">Overpaid:</strong>{" "}a payment over by more than the Slippage Tolerance.
            The invoice counts as paid and shows how much extra arrived. The client and the sender settle the difference
            between themselves.
          </p>
          <p className={BODY}>
            SatSend can&apos;t refund or move a payment, because it never holds the money. Bitcoin payments can&apos;t be
            reversed, so any difference is settled directly between the two of you.
          </p>
        </Section>

        <Section id="no-held-amount" title="Paying without a held amount">
          <p className={BODY}>
            Sometimes a payment doesn&apos;t match a held amount: the client paid more than 30 minutes after opening it, or
            paid from the PDF, whose QR code doesn&apos;t include the amount. Then the payment is valued at the exchange
            rate when SatSend first sees it, and judged with the same Slippage Tolerance.
          </p>
          <p className={BODY}>
            To be sure of paying the exact amount, open the invoice online and pay within the 30 minutes.
          </p>
        </Section>

        <Section id="confirmation" title="When a payment counts as paid">
          <p className={BODY}>
            SatSend spots a payment soon after it&apos;s sent, often within seconds, and shows{" "}
            <strong className="text-(--color-ink)">Payment detected</strong>. It counts as paid once it has two
            confirmations on the bitcoin blockchain, usually within about 20 minutes. Only then is the amount judged and
            the invoice marked Paid, Underpaid or Overpaid.
          </p>
          <p className={BODY}>
            The sender gets an email at each step, and so does the client when the invoice has their email address. Still
            have a question? See the{" "}
            <Link id="settlement--confirmation--faq" href="/faq" className={INLINE_LINK}>
              FAQ
            </Link>{" "}
            or{" "}
            <Link id="settlement--confirmation--contact" href="/contact" className={INLINE_LINK}>
              contact us
            </Link>
            .
          </p>
        </Section>
      </div>

      <ClosingCta idPrefix="settlement" />
    </>
  );
}
