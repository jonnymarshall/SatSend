"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/signal/button";
import { cn } from "@/lib/utils";

/*
 * The Free and Pro plan cards (v1.5.16; shared and given a Monthly / Yearly
 * toggle in v1.5.21). Used by the homepage and /pricing so they can't disagree.
 * Plan content: development/ROADMAP.md, "Monetisation plan (free vs Pro)".
 */

/** Pro: $10 a month, or $100 a year (2 months free). */
export const PRO_PRICE = { monthly: 10, yearly: 100 } as const;

type Period = "monthly" | "yearly";

export const FREE_FEATURES = [
  "Unlimited invoices",
  "Automatic payment detection",
  "Invoice link and PDF",
  "Invoices emailed to your client (sent from “SatSend”)",
  "“You've been paid” emails to you",
  "1 saved client",
  "Non-custodial: paid straight to your wallet",
];

export const PRO_FEATURES = [
  "Everything in Free",
  "Your own link: satsend.me/yourname",
  "Client pages: all of a client's invoices in one place",
  "Invoices emailed from your company name, with replies to you",
  "Unlimited saved clients and reusable line items",
  "Your logo and colours on invoices, PDFs and emails",
  "Automatic payment reminders",
];

const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

function PlanCard({
  id,
  name,
  price,
  priceNote,
  blurb,
  features,
  dark,
  tag,
}: {
  id: string;
  name: string;
  price: string;
  priceNote?: string;
  blurb: string;
  features: string[];
  dark?: boolean;
  tag?: string;
}) {
  return (
    <article
      id={id}
      aria-labelledby={`${id}--name`}
      className={cn(
        "flex flex-col rounded-(--radius-xl) border p-7 md:p-8",
        dark ? "border-(--color-ink) bg-(--color-ink) text-white" : "border-(--color-border) bg-(--color-surface) text-(--color-ink)",
      )}
    >
      <div className="flex items-center gap-3">
        <h3 id={`${id}--name`} className="text-[20px] font-semibold">
          {name}
        </h3>
        {tag ? (
          <span className="rounded-full bg-(--color-brand) px-2.5 py-0.5 text-[13px] font-semibold text-(--color-ink)">
            {tag}
          </span>
        ) : null}
      </div>
      <p id={`${id}--price`} className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-[48px] leading-none font-[800] tabular-nums">{price}</span>
        <span className={dark ? "text-white/75" : "text-(--color-text-secondary)"}>/ month</span>
      </p>
      {/* Always rendered so the cards don't jump when the period changes. */}
      <p id={`${id}--price-note`} className={cn("mt-2 min-h-5 text-sm", dark ? "text-white/75" : "text-(--color-text-secondary)")}>
        {priceNote ?? ""}
      </p>
      <Link
        id={`${id}--get-started`}
        href="/signup"
        className={cn(buttonVariants({ variant: dark ? "primary" : "secondary" }), "mt-4 w-full")}
      >
        Get started
      </Link>
      <p className={cn("mt-6 text-[15px] leading-[1.55]", dark ? "text-white/80" : "text-(--color-text-secondary)")}>{blurb}</p>
      <ul className={cn("mt-6 flex flex-col gap-3 border-t pt-6", dark ? "border-white/15" : "border-(--color-border)")}>
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[15px] leading-[1.45]">
            <Check aria-hidden className={cn("mt-0.5 size-4 shrink-0", dark ? "text-(--color-brand)" : "text-(--color-success-text)")} />
            {f}
          </li>
        ))}
      </ul>
    </article>
  );
}

function PeriodToggle({ idPrefix, period, onChange }: { idPrefix: string; period: Period; onChange: (p: Period) => void }) {
  const option = (value: Period, label: string, extra?: string) => {
    const checked = period === value;
    return (
      <button
        id={`${idPrefix}--period-${value}`}
        type="button"
        role="radio"
        aria-checked={checked}
        onClick={() => onChange(value)}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ink)",
          checked ? "bg-(--color-surface) text-(--color-ink) shadow-(--shadow-card)" : "text-(--color-text-secondary) hover:text-(--color-ink)",
        )}
      >
        {label}
        {extra ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[13px] font-semibold",
              checked ? "bg-(--color-success-soft) text-(--color-success-text)" : "bg-(--color-neutral-soft) text-(--color-text-secondary)",
            )}
          >
            {extra}
          </span>
        ) : null}
      </button>
    );
  };
  return (
    <div
      id={`${idPrefix}--period`}
      role="radiogroup"
      aria-label="Billing period"
      className="inline-flex items-center gap-1 rounded-full border border-(--color-border) bg-(--color-canvas) p-1"
    >
      {option("monthly", "Monthly")}
      {option("yearly", "Yearly", "2 months free")}
    </div>
  );
}

export function PricingPlans({ idPrefix }: { idPrefix: string }) {
  const [period, setPeriod] = useState<Period>("monthly");
  const proPerMonth = period === "monthly" ? PRO_PRICE.monthly : Math.floor((PRO_PRICE.yearly / 12) * 100) / 100;

  return (
    <div id={`${idPrefix}--plans`} className="flex flex-col items-center">
      <PeriodToggle idPrefix={idPrefix} period={period} onChange={setPeriod} />
      <div className="mt-8 grid w-full max-w-[920px] grid-cols-1 gap-6 md:grid-cols-2">
        <PlanCard
          id={`${idPrefix}--free`}
          name="Free"
          price="$0"
          blurb="Everything you need to invoice in bitcoin."
          features={FREE_FEATURES}
        />
        <PlanCard
          id={`${idPrefix}--pro`}
          name="Pro"
          price={usd(proPerMonth)}
          priceNote={period === "yearly" ? `Billed ${usd(PRO_PRICE.yearly)} yearly` : undefined}
          tag="Coming soon"
          dark
          blurb="For freelancers who want to look established and get paid on time."
          features={PRO_FEATURES}
        />
      </div>
      <p id={`${idPrefix}--pro-note`} className="mt-6 max-w-[60ch] text-center text-sm text-(--color-text-secondary)">
        Pay for Pro in bitcoin or by card. Pro features are on the way: start free today and upgrade when they land.
      </p>
    </div>
  );
}
