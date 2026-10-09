import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Signal Amber text field (v1.5.0-H): label above, helper and error below, never a
 * placeholder-as-label. 44px tall, 16px text (no iOS zoom), translucent amber focus
 * ring (DESIGN.md §9).
 *
 * `outline="spec"` is the handoff border (#ECE8DD, 1.22:1 on white — below the 3:1
 * non-text minimum); `outline="strong"` is the PROPOSED AA outline. Decision pending.
 */
export type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  leadingIcon?: ReactNode;
  outline?: "spec" | "strong";
  forceFocus?: boolean;
};

export function Field({
  id,
  label,
  helper,
  error,
  leadingIcon,
  outline = "spec",
  forceFocus,
  className,
  disabled,
  ...props
}: FieldProps) {
  const helperId = helper ? `${id}--helper` : undefined;
  const errorId = error ? `${id}--error` : undefined;
  return (
    <div id={`${id}--field`} className={cn("flex flex-col gap-2", className)}>
      <label
        id={`${id}--label`}
        htmlFor={id}
        className={cn("text-sm font-medium", disabled ? "text-(--color-text-secondary)" : "text-(--color-ink)")}
      >
        {label}
      </label>
      <div className="relative">
        {leadingIcon ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-(--color-text-secondary) [&_svg]:size-4"
          >
            {leadingIcon}
          </span>
        ) : null}
        <input
          id={id}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, helperId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "h-11 w-full rounded-(--radius-md) border bg-(--color-surface) px-3.5 text-base text-(--color-ink)",
            "placeholder:text-(--color-text-secondary) transition-[border-color,outline-color] duration-150",
            "focus-visible:border-(--color-brand) focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-[rgba(216,155,36,0.18)]",
            outline === "strong" ? "border-(--color-border-strong)" : "border-(--color-border)",
            leadingIcon && "pl-10",
            error && "border-(--color-danger) focus-visible:border-(--color-danger) focus-visible:outline-[rgba(217,95,95,0.18)]",
            disabled && "cursor-not-allowed bg-(--color-neutral-soft) text-(--color-text-secondary)",
            forceFocus && "border-(--color-brand) outline-3 outline-offset-1 outline-[rgba(216,155,36,0.18)]",
          )}
          {...props}
        />
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-(--color-danger-text)">
          {error}
        </p>
      ) : null}
      {helper ? (
        <p id={helperId} className="text-sm text-(--color-text-secondary)">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
