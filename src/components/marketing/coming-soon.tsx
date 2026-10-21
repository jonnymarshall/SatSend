import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/signal/button";
import { PLACEHOLDER_PAGES } from "@/lib/site-links";

/*
 * Placeholder pages (v1.5.16). Every page the menu and footer link to exists at
 * its real address; until it's built (each is its own roadmap item before
 * launch) it says "Coming soon". Kept out of search results meanwhile.
 */

type PlaceholderPath = (typeof PLACEHOLDER_PAGES)[number]["path"];

const pageFor = (path: PlaceholderPath) => PLACEHOLDER_PAGES.find((p) => p.path === path)!;

export function comingSoonMetadata(path: PlaceholderPath): Metadata {
  const page = pageFor(path);
  return {
    title: `${page.title} · SatSend`,
    description: page.description,
    robots: { index: false, follow: true },
  };
}

export function ComingSoon({ path }: { path: PlaceholderPath }) {
  const page = pageFor(path);
  return (
    <section
      id="coming-soon"
      aria-labelledby="coming-soon--heading"
      className="mx-auto flex w-full max-w-(--container-max) flex-1 flex-col items-start justify-center px-4 py-24 sm:px-6 md:px-10 md:py-32"
    >
      <p className="text-[13px] font-semibold tracking-[0.08em] text-(--color-text-secondary) uppercase">Coming soon</p>
      <h1
        id="coming-soon--heading"
        className="font-display tracking-display mt-4 text-[40px] leading-[1.05] font-[800] md:text-[56px]"
      >
        {page.title}
      </h1>
      <p className="mt-5 max-w-[48ch] text-[18px] leading-[1.55] text-(--color-text-secondary)">
        We&apos;re still writing this page. In the meantime, the homepage covers how SatSend works.
      </p>
      <Link id="coming-soon--home" href="/" className={buttonVariants({ variant: "secondary", className: "mt-8" })}>
        Back to the homepage
      </Link>
    </section>
  );
}
