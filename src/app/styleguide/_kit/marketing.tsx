import { ArrowRight } from "lucide-react";
import tokens from "../../../../satsend-brand-handoff/design-tokens.json";
import { SatSendLogo } from "@/components/brand/satsend-logo";
import { buttonVariants } from "@/components/signal/button";
import { aaThreshold, contrastRatio, type ContrastUse } from "@/lib/design/contrast";
import { BORDER_STRONG, BRAND_STRONG, PALETTE, TEXT_SHADES } from "@/lib/design/adopted-tokens";
import { cn } from "@/lib/utils";
import { InvoiceListItem, PaymentPanel } from "./patterns";
import { KitSection, Tok, Verdict } from "./section";

/** The handoff as delivered, and the palette we use now (handoff + decided overrides). */
const SPEC = tokens.color;
const NOW = PALETTE;

/* ------------------------------------------------- Marketing composition */

function NavLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <a
      id={id}
      href="#styleguide--marketing"
      className="inline-flex min-h-11 items-center rounded-(--radius-sm) px-1 text-[15px] font-medium text-(--color-ink) decoration-(--color-brand) decoration-2 underline-offset-[6px] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ink)"
    >
      {children}
    </a>
  );
}

export function MarketingSection() {
  return (
    <KitSection
      id="marketing"
      index={7}
      title="Marketing composition"
      intro="Nav, hero and footer at real size, so the logo lockup and type scale can be judged on a full canvas. The hero visual is the product itself, not an illustration."
    >
      <div
        id="styleguide--marketing--frame"
        className="overflow-hidden rounded-(--radius-xl) border border-(--color-border) bg-(--color-canvas)"
      >
        <header id="styleguide--marketing--nav" className="border-b border-(--color-border)">
          <nav
            aria-label="Marketing preview"
            className="mx-auto flex h-18 max-w-(--container-max) items-center justify-between gap-6 px-6 md:px-10"
          >
            <a id="styleguide--marketing--nav--logo" href="#styleguide--marketing" aria-label="SatSend home" className="flex min-h-11 w-[140px] items-center">
              <SatSendLogo style={{ width: 140 }} />
            </a>
            <div className="hidden items-center gap-8 md:flex">
              <NavLink id="styleguide--marketing--nav--how">How it works</NavLink>
              <NavLink id="styleguide--marketing--nav--pricing">Pricing</NavLink>
            </div>
            <div className="flex items-center gap-5">
              <NavLink id="styleguide--marketing--nav--login">Log in</NavLink>
              <a id="styleguide--marketing--nav--cta" href="#styleguide--marketing" className={cn(buttonVariants(), "hidden sm:inline-flex")}>
                Get started
              </a>
            </div>
          </nav>
        </header>

        <section
          id="styleguide--marketing--hero"
          aria-labelledby="styleguide--marketing--hero--heading"
          className="mx-auto grid max-w-(--container-max) grid-cols-1 items-center gap-12 px-6 pt-16 pb-20 md:px-10 md:pt-24 md:pb-28 lg:grid-cols-[1.05fr_1fr] lg:gap-16"
        >
          <div className="flex flex-col items-start">
            <p className="text-[13px] font-semibold tracking-[0.08em] text-(--color-text-secondary) uppercase">
              Bitcoin invoicing for independent professionals
            </p>
            <h1
              id="styleguide--marketing--hero--heading"
              className="font-display tracking-display mt-5 text-[44px] leading-[1.04] font-[800] md:text-[64px] md:leading-[1.02]"
            >
              Invoice in minutes.
              <br />
              <span className="text-(--color-brand-strong)">Get paid in bitcoin.</span>
            </h1>
            <p className="mt-6 max-w-[44ch] text-[18px] leading-[1.55] text-(--color-text-secondary)">
              Create an invoice, share a payment link, and see the moment your client pays in bitcoin.
            </p>
            <a
              id="styleguide--marketing--hero--cta"
              href="#styleguide--marketing"
              className={cn(buttonVariants({ size: "lg" }), "mt-9")}
            >
              Get started
              <ArrowRight />
            </a>
          </div>

          <div id="styleguide--marketing--hero--visual" className="relative lg:pb-16">
            <PaymentPanel idPrefix="styleguide--marketing--hero" status="payment_detected" qrSize={136} showNote={false} className="lg:mr-10" />
            <InvoiceListItem
              idPrefix="styleguide--marketing--hero"
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

        <footer id="styleguide--marketing--footer" className="border-t border-(--color-border)">
          <div className="mx-auto flex max-w-(--container-max) flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-10">
            <div className="flex flex-col gap-2">
              <SatSendLogo style={{ width: 120 }} />
              <p className="text-sm text-(--color-text-secondary)">Bitcoin invoicing for independent professionals.</p>
            </div>
            <nav aria-label="Footer preview" className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <NavLink id="styleguide--marketing--footer--privacy">Privacy</NavLink>
              <NavLink id="styleguide--marketing--footer--terms">Terms</NavLink>
              <NavLink id="styleguide--marketing--footer--contact">Contact</NavLink>
              <span className="text-sm text-(--color-text-secondary)">© 2026 SatSend</span>
            </nav>
          </div>
        </footer>
      </div>
    </KitSection>
  );
}

/* ---------------------------------------------------- Contrast audit */

type Pair = { fg: string; bg: string };
type Row = { what: string; where: string; use: ContrastUse; spec: Pair; now: Pair & { label: string } };

const same = (p: Pair, label = "Unchanged") => ({ ...p, label });

const ROWS: Row[] = [
  { what: "Ink on amber", where: "Primary button label", use: "text", spec: { fg: SPEC.ink, bg: SPEC.brand }, now: same({ fg: NOW.ink, bg: NOW.brand }) },
  { what: "White on amber", where: "Primary button label (alternative)", use: "text", spec: { fg: "#FFFFFF", bg: SPEC.brand }, now: { fg: NOW.ink, bg: NOW.brand, label: "Not used: buttons use ink text" } },
  { what: "Ink on page", where: "Body text, headings", use: "text", spec: { fg: SPEC.ink, bg: SPEC.canvas }, now: same({ fg: NOW.ink, bg: NOW.canvas }) },
  { what: "Grey text on page", where: "Metadata, helper text", use: "text", spec: { fg: SPEC.textSecondary, bg: SPEC.canvas }, now: same({ fg: NOW.textSecondary, bg: NOW.canvas }) },
  { what: "Grey text on card", where: "Metadata in cards", use: "text", spec: { fg: SPEC.textSecondary, bg: SPEC.surface }, now: same({ fg: NOW.textSecondary, bg: NOW.surface }) },
  { what: "Link text", where: "Links in body copy", use: "text", spec: { fg: SPEC.brand, bg: SPEC.canvas }, now: { fg: NOW.ink, bg: NOW.canvas, label: "Ink text, amber underline" } },
  { what: "Amber headline", where: "Hero line two", use: "large-text", spec: { fg: SPEC.brand, bg: SPEC.canvas }, now: { fg: BRAND_STRONG.value, bg: NOW.canvas, label: `${BRAND_STRONG.token} ${BRAND_STRONG.value}` } },
  { what: "Input focus border", where: "Text fields while typing", use: "ui", spec: { fg: SPEC.brand, bg: SPEC.surface }, now: { fg: BRAND_STRONG.value, bg: NOW.surface, label: `${BRAND_STRONG.token} ${BRAND_STRONG.value}` } },
  { what: "Input outline", where: "Text fields at rest", use: "ui", spec: { fg: SPEC.border, bg: SPEC.surface }, now: { fg: BORDER_STRONG.value, bg: NOW.surface, label: `${BORDER_STRONG.token} ${BORDER_STRONG.value}` } },
  { what: "Error text", where: "Form error messages", use: "text", spec: { fg: SPEC.danger, bg: SPEC.surface }, now: { fg: TEXT_SHADES.danger.value, bg: NOW.surface, label: `${TEXT_SHADES.danger.token} ${TEXT_SHADES.danger.value}` } },
  ...(["success", "sent", "detected", "warning", "danger", "neutral"] as const).map((k) => ({
    what: `${{ success: "Paid", sent: "Pending", detected: "Payment detected", warning: "Underpaid", danger: "Overdue", neutral: "Draft" }[k]} badge`,
    where: "Status badge word, 13px",
    use: "text" as const,
    spec: { fg: SPEC[k], bg: SPEC[`${k}Soft` as const] },
    now: { fg: TEXT_SHADES[k].value, bg: NOW[`${k}Soft` as const], label: `${TEXT_SHADES[k].token} ${TEXT_SHADES[k].value}` },
  })),
];

function Ratio({ pair, use }: { pair: Pair; use: ContrastUse }) {
  const r = contrastRatio(pair.fg, pair.bg);
  return (
    <span className="flex items-center gap-2">
      <Verdict pass={r >= aaThreshold(use)} />
      <Tok>{r.toFixed(1)}:1</Tok>
    </span>
  );
}

export function AuditSection() {
  const fails = (p: (r: Row) => Pair) => ROWS.filter((r) => contrastRatio(p(r).fg, p(r).bg) < aaThreshold(r.use)).length;
  const specFails = fails((r) => r.spec);
  const nowFails = fails((r) => r.now);
  return (
    <KitSection
      id="audit"
      index={8}
      title="Contrast check"
      intro={
        <>
          <p>
            Contrast is how much a colour stands out from what is behind it. 1:1 is invisible; black on white is 21:1.
            Small text needs at least <strong className="font-semibold text-(--color-ink)">4.5:1</strong>; big headings
            and the outlines of controls need <strong className="font-semibold text-(--color-ink)">3:1</strong>. Every
            number below is calculated from the real colours.
          </p>
          <p id="styleguide--audit--summary" className="mt-3 font-semibold text-(--color-ink)">
            {nowFails === 0 ? `Everything we use now passes (${ROWS.length} of ${ROWS.length}).` : `${nowFails} of ${ROWS.length} still fail.`}{" "}
            <span className="font-normal text-(--color-text-secondary)">
              The handoff had {specFails} that did not. The last column shows what each one uses now.
            </span>
          </p>
        </>
      }
    >
      <div className="overflow-x-auto rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface)">
        <table id="styleguide--audit--table" className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-(--color-border) text-[13px] text-(--color-text-secondary)">
              <th scope="col" className="px-5 py-3 font-medium">What</th>
              <th scope="col" className="px-5 py-3 font-medium">Where</th>
              <th scope="col" className="px-5 py-3 font-medium">Needs</th>
              <th scope="col" className="px-5 py-3 font-medium">Handoff</th>
              <th scope="col" className="px-5 py-3 font-medium">Now</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.what} className="proxy-id--styleguide--audit--row border-b border-(--color-border) last:border-0">
                <td className="px-5 py-3 font-medium">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-(--radius-sm) border border-(--color-border) text-[12px] font-bold" style={{ background: r.now.bg, color: r.now.fg }}>
                      Aa
                    </span>
                    {r.what}
                  </span>
                </td>
                <td className="px-5 py-3 text-(--color-text-secondary)">{r.where}</td>
                <td className="px-5 py-3">
                  <Tok>{aaThreshold(r.use)}:1</Tok>
                </td>
                <td className="px-5 py-3">
                  <Ratio pair={r.spec} use={r.use} />
                </td>
                <td className="px-5 py-3">
                  <span className="flex flex-col gap-1">
                    <Ratio pair={r.now} use={r.use} />
                    <span className="text-[12px] text-(--color-text-secondary)">{r.now.label}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </KitSection>
  );
}
