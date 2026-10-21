import { ChevronDown } from "lucide-react";
import type { FaqItem } from "./faq-content";

/** The fold-out question list used by the homepage, /pricing and /faq (v1.5.22). */
export function FaqList({ items, idPrefix }: { items: FaqItem[]; idPrefix: string }) {
  return (
    <div className="divide-y divide-(--color-border) border-y border-(--color-border)">
      {items.map(({ id, q, a }) => (
        <details key={id} id={`${idPrefix}--${id}`} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[17px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ink) [&::-webkit-details-marker]:hidden">
            {q}
            <ChevronDown aria-hidden className="size-5 shrink-0 text-(--color-text-secondary) transition-transform group-open:rotate-180" />
          </summary>
          <p className="pb-5 text-[15px] leading-[1.6] text-(--color-text-secondary)">{a}</p>
        </details>
      ))}
    </div>
  );
}
