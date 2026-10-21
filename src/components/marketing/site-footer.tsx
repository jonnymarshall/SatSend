import Link from "next/link";
import { LogoHomeLink } from "@/components/brand/logo-home-link";
import { buttonVariants } from "@/components/signal/button";
import { FOOTER_COLUMNS, SOCIAL_LINKS } from "@/lib/site-links";

const FOOTER_LINK =
  "inline-flex min-h-11 items-center rounded-(--radius-sm) text-[15px] text-(--color-text-secondary) hover:text-(--color-ink) hover:underline decoration-(--color-brand) decoration-2 underline-offset-[6px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ink) md:min-h-9";

const ICON_LINK =
  "inline-flex size-11 items-center justify-center rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) text-(--color-ink) hover:border-(--color-border-strong) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ink)";

// Brand marks aren't in lucide; simple single-path glyphs.
function XIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/** Marketing footer (v1.5.16): brand block plus Product, Company, Developers, Legal. */
export function SiteFooter() {
  return (
    <footer id="site--footer" className="border-t border-(--color-border) bg-(--color-surface)">
      <div className="mx-auto max-w-(--container-max) px-4 pt-14 pb-10 sm:px-6 md:px-10">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-6">
          <div id="site--footer--brand" className="col-span-2 flex flex-col items-start gap-4">
            <LogoHomeLink id="site--footer--logo" logoStyle={{ width: 120 }} />
            <p className="max-w-[30ch] text-[15px] text-(--color-text-secondary)">
              Bitcoin invoicing for independent professionals.
            </p>
            <Link id="site--footer--get-started" href="/signup" className={buttonVariants()}>
              Get started
            </Link>
            <div id="site--footer--social" className="mt-1 flex gap-3">
              <Link id="site--footer--social-x" href={SOCIAL_LINKS.x} aria-label="SatSend on X" className={ICON_LINK}>
                <XIcon />
              </Link>
              <Link
                id="site--footer--social-linkedin"
                href={SOCIAL_LINKS.linkedin}
                aria-label="SatSend on LinkedIn"
                className={ICON_LINK}
              >
                <LinkedInIcon />
              </Link>
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => {
            const slug = column.heading.toLowerCase();
            return (
              <nav key={column.heading} id={`site--footer--${slug}`} aria-labelledby={`site--footer--${slug}-heading`}>
                <h2 id={`site--footer--${slug}-heading`} className="text-sm font-semibold text-(--color-ink)">
                  {column.heading}
                </h2>
                <ul className="mt-2 flex flex-col">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className={FOOTER_LINK}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            );
          })}
        </div>

        <div
          id="site--footer--bottom"
          className="mt-12 flex flex-col gap-2 border-t border-(--color-border) pt-6 text-sm text-(--color-text-secondary) sm:flex-row sm:items-center sm:justify-between"
        >
          <p>© 2026 SatSend</p>
          <p>Non-custodial. SatSend never holds your bitcoin.</p>
        </div>
      </div>
    </footer>
  );
}
