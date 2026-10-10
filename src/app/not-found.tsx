import Link from "next/link";
import { SatSendMark } from "@/components/brand/satsend-mark";
import { buttonVariants } from "@/components/signal/button";

export default function NotFound() {
  return (
    <main
      id="root-not-found"
      className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center"
    >
      <SatSendMark id="root-not-found--mark" aria-hidden className="size-12" />
      <p id="root-not-found--code" className="text-sm font-medium text-(--color-text-secondary)">
        404
      </p>
      <h1 id="root-not-found--title" className="font-display tracking-heading -mt-3 text-3xl font-bold">
        Page not found
      </h1>
      <p id="root-not-found--body" className="max-w-md text-base text-(--color-text-secondary)">
        The page you are looking for does not exist, or it may have been moved.
      </p>
      <Link id="root-not-found--home-link" href="/" className={buttonVariants({ variant: "secondary" })}>
        Go home
      </Link>
    </main>
  );
}
