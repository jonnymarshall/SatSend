import { ArrowRight } from "lucide-react";
import tokens from "../../../../satsend-brand-handoff/design-tokens.json";
import { SatSendLogo } from "@/components/brand/satsend-logo";
import { buttonVariants } from "@/components/signal/button";
import { aaThreshold, contrastRatio, type ContrastUse } from "@/lib/design/contrast";
import { PROPOSED_BORDER_STRONG, PROPOSED_TEXT_SHADES } from "@/lib/design/proposed-tokens";
import { cn } from "@/lib/utils";
import { InvoiceListItem, PaymentPanel } from "./patterns";
import { KitSection, Tok, Verdict } from "./section";

const C = tokens.color;

/* ------------------------------------------------- Marketing composition */

function NavLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <a
      id={id}
      href="#styleguide--marketing"
      className="inline-flex min-h-11 items-center rounded-(--radius-sm) px-1 text-[15px] font-medium text-(--color-ink) hover:text-(--color-brand-text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ink)"
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
              <span className="text-(--color-brand)">Get paid in bitcoin.</span>
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

type Row = { pair: string; where: string; fg: string; bg: string; use: ContrastUse; proposal?: { fg: string; label: string }; resolved?: string };

const ROWS: Row[] = [
  { pair: "Ink on brand", where: "Primary button label", fg: C.ink, bg: C.brand, use: "text" },
  { pair: "White on brand", where: "Rejected primary label", fg: "#FFFFFF", bg: C.brand, use: "text", resolved: "Not used: buttons use ink" },
  { pair: "Ink on canvas", where: "Body text, headings", fg: C.ink, bg: C.canvas, use: "text" },
  { pair: "Secondary on canvas", where: "Metadata, helper text", fg: C.textSecondary, bg: C.canvas, use: "text" },
  { pair: "Secondary on surface", where: "Metadata in cards", fg: C.textSecondary, bg: C.surface, use: "text" },
  { pair: "Brand on canvas, small", where: "Links (DESIGN.md says brand)", fg: C.brand, bg: C.canvas, use: "text", proposal: { fg: PROPOSED_TEXT_SHADES.brand.value, label: "--color-brand-text" } },
  { pair: "Brand on canvas, display", where: "Hero line two (reference board)", fg: C.brand, bg: C.canvas, use: "large-text", proposal: { fg: PROPOSED_TEXT_SHADES.brand.value, label: "--color-brand-text" } },
  { pair: "Brand on surface", where: "Input focus border", fg: C.brand, bg: C.surface, use: "ui" },
  { pair: "Border on surface", where: "Input outline", fg: C.border, bg: C.surface, use: "ui", proposal: { fg: PROPOSED_BORDER_STRONG.value, label: "--color-border-strong" } },
  { pair: "Danger on surface", where: "Form error text", fg: C.danger, bg: C.surface, use: "text", proposal: { fg: PROPOSED_TEXT_SHADES.danger.value, label: "--color-danger-text" } },
  ...(["success", "sent", "detected", "warning", "danger", "neutral"] as const).map((k) => ({
    pair: `${k[0].toUpperCase()}${k.slice(1)} on its soft`,
    where: "Status badge label, 13px",
    fg: C[k],
    bg: C[`${k}Soft` as const],
    use: "text" as const,
    proposal: { fg: PROPOSED_TEXT_SHADES[k].value, label: PROPOSED_TEXT_SHADES[k].token },
  })),
];

export function AuditSection() {
  const fails = ROWS.filter((r) => !r.resolved && contrastRatio(r.fg, r.bg) < aaThreshold(r.use)).length;
  return (
    <KitSection
      id="audit"
      index={8}
      title="Contrast audit"
      intro={
        <>
          Every ratio here is computed from the tokens, against WCAG 2.2 AA (4.5:1 text, 3:1 large text and UI).{" "}
          <strong className="font-semibold text-(--color-ink)">{fails} spec pairings fail.</strong> Where the fix is
          mechanical, a proposal sits beside it, made by darkening the same hue toward ink. Nothing is adopted until
          you decide.
        </>
      }
    >
      <div className="overflow-x-auto rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface)">
        <table id="styleguide--audit--table" className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-(--color-border) text-[13px] text-(--color-text-secondary)">
              <th scope="col" className="px-5 py-3 font-medium">Pairing</th>
              <th scope="col" className="px-5 py-3 font-medium">Used for</th>
              <th scope="col" className="px-5 py-3 font-medium">Needs</th>
              <th scope="col" className="px-5 py-3 font-medium">Spec</th>
              <th scope="col" className="px-5 py-3 font-medium">Proposal</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const ratio = contrastRatio(r.fg, r.bg);
              const need = aaThreshold(r.use);
              const p = r.proposal ? contrastRatio(r.proposal.fg, r.bg) : null;
              return (
                <tr key={r.pair} className="proxy-id--styleguide--audit--row border-b border-(--color-border) last:border-0">
                  <td className="px-5 py-3 font-medium">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="flex size-6 items-center justify-center rounded-(--radius-sm) border border-(--color-border) text-[12px] font-bold" style={{ background: r.bg, color: r.fg }}>
                        Aa
                      </span>
                      {r.pair}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-(--color-text-secondary)">{r.where}</td>
                  <td className="px-5 py-3">
                    <Tok>{need}:1</Tok>
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2">
                      <Verdict pass={ratio >= need} />
                      <Tok>{ratio.toFixed(2)}:1</Tok>
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {r.proposal && ratio < need ? (
                      <span className="flex items-center gap-2">
                        <Verdict pass={p! >= need} />
                        <Tok>
                          {p!.toFixed(2)}:1 {r.proposal.label} {r.proposal.fg}
                        </Tok>
                      </span>
                    ) : ratio < need ? (
                      <span className="text-(--color-text-secondary)">{r.resolved ?? "Decision needed"}</span>
                    ) : (
                      <span className="text-(--color-text-secondary)">None needed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </KitSection>
  );
}
