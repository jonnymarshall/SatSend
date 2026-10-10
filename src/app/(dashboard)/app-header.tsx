import Link from "next/link";
import { SatSendLogo } from "@/components/brand/satsend-logo";

/**
 * Signed-in app header (v1.5-H): white bar, warm border, the SatSend wordmark on
 * the left (links to the invoice list), account controls on the right.
 */
export function AppHeader({ email, children }: { email: string; children?: React.ReactNode }) {
  return (
    <header id="nav--header" className="border-b border-(--color-border) bg-(--color-surface)">
      <div
        id="nav--inner"
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6 lg:px-10"
      >
        <Link
          id="nav--logo-link"
          href="/invoices"
          aria-label="SatSend, go to invoices"
          className="-mx-1 flex min-h-11 items-center rounded-(--radius-sm) px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ink)"
        >
          <SatSendLogo aria-hidden style={{ width: 128, marginLeft: -7 }} />
        </Link>
        <div id="nav--right" className="flex min-w-0 items-center gap-4">
          <span
            id="nav--user-email"
            className="hidden truncate text-sm text-(--color-text-secondary) sm:inline"
          >
            {email}
          </span>
          {children}
        </div>
      </div>
    </header>
  );
}

/** Page frame shared by the real and dev-bypass branches of the dashboard layout. */
export function AppMain({ children }: { children: React.ReactNode }) {
  return (
    <main id="dashboard--main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 lg:px-10 lg:py-10">
      {children}
    </main>
  );
}
