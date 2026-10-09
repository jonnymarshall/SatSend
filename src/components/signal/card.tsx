import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Signal Amber card (v1.5.0-H). Borders before shadows (DESIGN.md §7, §14.7):
 * `product` is surface + 1px border + 16px radius; `marketing` uses 24px radius and
 * more padding. `elevated` adds the card shadow and is meant to be rare.
 */
export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "product" | "marketing";
  elevated?: boolean;
};

export function Card({ variant = "product", elevated, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "border border-(--color-border) bg-(--color-surface)",
        variant === "product" ? "rounded-(--radius-lg) p-5 md:p-6" : "rounded-(--radius-xl) p-8 md:p-10",
        elevated && "shadow-(--shadow-card)",
        className,
      )}
      {...props}
    />
  );
}
