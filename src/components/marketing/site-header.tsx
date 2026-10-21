import Link from "next/link";
import { LogoHomeLink } from "@/components/brand/logo-home-link";
import { buttonVariants } from "@/components/signal/button";
import { createClient } from "@/lib/supabase/server";
import { NAV_LINKS } from "@/lib/site-links";
import { cn } from "@/lib/utils";

const NAV_LINK =
  "inline-flex min-h-11 items-center rounded-(--radius-sm) px-1 text-[15px] font-medium text-(--color-ink) decoration-(--color-brand) decoration-2 underline-offset-[6px] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ink)";

/**
 * Marketing top menu (v1.5.16). `/` is the homepage for everyone, so signed-in
 * visitors get "Go to app" here instead of being redirected.
 */
export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header id="site--header" className="border-b border-(--color-border) bg-(--color-canvas)">
      <nav
        aria-label="Main"
        className="mx-auto flex h-18 max-w-(--container-max) items-center justify-between gap-6 px-4 sm:px-6 md:px-10"
      >
        <LogoHomeLink id="site--header--logo" logoStyle={{ width: 132 }} />
        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link id={`site--header--nav-${link.href.slice(1)}`} href={link.href} className={NAV_LINK}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 sm:gap-5">
          {user ? (
            <Link id="site--header--go-to-app" href="/dashboard" className={buttonVariants()}>
              Go to app
            </Link>
          ) : (
            <>
              <Link id="site--header--login" href="/login" className={NAV_LINK}>
                Log in
              </Link>
              <Link id="site--header--get-started" href="/signup" className={cn(buttonVariants())}>
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
