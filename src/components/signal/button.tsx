import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Signal Amber button (v1.5.0-H). Built against the scoped tokens; promoted to
 * replace src/components/ui/button.tsx in v1.5-H.
 *
 * Primary uses INK text on amber: white on #D89B24 is 2.43:1 (fails AA), ink is
 * 6.98:1 (DESIGN.md §12). Default height is 44px (the touch minimum).
 */
export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap",
    "rounded-(--radius-md) border font-semibold transition-[background-color,border-color,color,transform] duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ink)",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
    "aria-busy:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-(--color-brand) text-(--color-ink) hover:bg-(--color-brand-hover)",
        secondary:
          "border-(--color-border) bg-(--color-surface) text-(--color-ink) hover:border-(--color-border-strong) hover:bg-(--color-canvas)",
        ghost:
          "border-transparent bg-transparent text-(--color-ink) hover:bg-(--color-neutral-soft)",
        danger:
          "border-transparent bg-(--color-danger-soft) text-(--color-danger-text) hover:bg-[#F9DADA]",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-[15px]",
        lg: "h-13 px-6 text-base",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { loading?: boolean };

export function Button({ className, variant, size, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant, size }), className)}
      aria-busy={loading || undefined}
      disabled={disabled}
      {...props}
    >
      {loading ? <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" /> : null}
      {children}
    </button>
  );
}
