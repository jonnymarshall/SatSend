import { SatSendLogo } from "@/components/brand/satsend-logo";
import { ComponentsSection, PatternsSection } from "./_kit/components";
import { ColourSection, FoundationsSection, LogoSection, TypeSection } from "./_kit/foundations";
import { AuditSection, MarketingSection } from "./_kit/marketing";

/*
 * Internal, TEMPORARY UI kit for the v1.5 Signal Amber redesign (v1.5.0-H).
 * Gated by SHOW_UI_KIT=1 in ./layout.tsx. Delete this whole folder at the end of
 * v1.5-H (tracked in development/OUTSTANDING-VERIFICATIONS.md).
 */

const NAV = [
  ["logo", "Logo"],
  ["colour", "Colour"],
  ["type", "Type"],
  ["foundations", "Foundations"],
  ["components", "Components"],
  ["patterns", "Patterns"],
  ["marketing", "Marketing"],
  ["audit", "Contrast"],
] as const;

export default function StyleguidePage() {
  return (
    <>
      <header
        id="styleguide--header"
        className="sticky top-0 z-20 border-b border-(--color-border) bg-(--color-canvas)/92 backdrop-blur-md"
      >
        <div className="mx-auto flex h-16 max-w-(--container-max) items-center gap-6 px-6 md:px-10">
          <a id="styleguide--header--logo" href="#styleguide--top" aria-label="Back to top" className="flex min-h-11 w-[126px] shrink-0 items-center">
            <SatSendLogo style={{ width: 126 }} />
          </a>
          <nav id="styleguide--header--nav" aria-label="Kit sections" className="-mx-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#styleguide--${id}`}
                className="proxy-id--styleguide--header--nav-link inline-flex min-h-11 shrink-0 items-center rounded-(--radius-sm) px-2.5 text-sm font-medium text-(--color-text-secondary) hover:text-(--color-ink) focus-visible:outline-2 focus-visible:outline-(--color-ink)"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main id="styleguide--top" className="mx-auto max-w-(--container-max) px-6 md:px-10">
        <div id="styleguide--intro" className="max-w-[60ch] py-16 md:py-24">
          <h1 className="font-display tracking-display text-[44px] leading-[1.05] font-[800] text-balance md:text-[64px] md:leading-[1.02]">
            Signal Amber, on one page.
          </h1>
          <p className="mt-6 text-[18px] leading-[1.55] text-(--color-text-secondary)">
            Every token and component for the v1.5 redesign, rendered with the real code before any live screen changes.
            Internal and temporary: this page is deleted at the end of v1.5-H.
          </p>
        </div>
        <LogoSection />
        <ColourSection />
        <TypeSection />
        <FoundationsSection />
        <ComponentsSection />
        <PatternsSection />
        <MarketingSection />
        <AuditSection />
        <footer id="styleguide--footer" className="border-t border-(--color-border) py-10 text-sm text-(--color-text-secondary)">
          Sources: satsend-brand-handoff/DESIGN.md, design-tokens.css and OPTION-D-reference.png. Everything we changed
          or added after the 9 Oct review is recorded in src/lib/design/adopted-tokens.ts.
        </footer>
      </main>
    </>
  );
}
