import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Section shell for the internal kit. Numbered because the kit is a document. */
export function KitSection({
  id,
  index,
  title,
  intro,
  children,
  className,
}: {
  id: string;
  index: number;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={`styleguide--${id}`}
      aria-labelledby={`styleguide--${id}--heading`}
      className={cn("scroll-mt-20 border-t border-(--color-border) py-14 md:py-20", className)}
    >
      <div className="mb-10 max-w-[65ch]">
        <h2
          id={`styleguide--${id}--heading`}
          className="font-display tracking-heading text-[24px] leading-[1.25] font-[700] md:text-[28px]"
        >
          <span className="text-(--color-text-secondary)">{index}.</span> {title}
        </h2>
        {intro ? (
          <div className="mt-3 text-base leading-[1.55] text-(--color-text-secondary)">{intro}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** A labelled specimen block inside a section. */
export function Specimen({
  id,
  title,
  note,
  children,
  className,
}: {
  id: string;
  title: string;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div id={id} className={cn("flex flex-col gap-4", className)}>
      <div>
        <h3 id={`${id}--title`} className="text-[15px] font-semibold text-(--color-ink)">
          {title}
        </h3>
        {note ? <p className="mt-1 text-sm leading-[1.45] text-(--color-text-secondary)">{note}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Code-ish token reference (token names are identifiers, so mono is right here). */
export function Tok({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[12px] text-(--color-text-secondary)">{children}</code>;
}

export function Verdict({ pass }: { pass: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-(--radius-sm) px-1.5 py-0.5 text-[12px] font-semibold",
        pass
          ? "bg-(--color-success-soft) text-(--color-success-text)"
          : "bg-(--color-danger-soft) text-(--color-danger-text)",
      )}
    >
      {pass ? "Pass" : "Fail"}
    </span>
  );
}
