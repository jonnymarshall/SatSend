import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/signal/button";
import { cn } from "@/lib/utils";
import { CONTAINER, H2 } from "./styles";

/** The full-width dark "Start invoicing in bitcoin" band that closes each marketing page. */
export function ClosingCta({ idPrefix }: { idPrefix: string }) {
  return (
    <section id={`${idPrefix}--cta`} aria-labelledby={`${idPrefix}--cta--heading`} className="bg-(--color-ink) text-white">
      <div className={cn(CONTAINER, "flex flex-col items-center py-20 text-center md:py-28")}>
        <h2 id={`${idPrefix}--cta--heading`} className={H2}>
          Start invoicing in bitcoin.
        </h2>
        <p className="mt-4 text-[18px] text-white/80">Free to start. Nothing to set up.</p>
        <Link id={`${idPrefix}--cta--get-started`} href="/signup" className={buttonVariants({ size: "lg", className: "mt-8" })}>
          Get started
          <ArrowRight />
        </Link>
      </div>
    </section>
  );
}
