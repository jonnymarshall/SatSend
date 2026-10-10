import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { inputClassName } from "./input";

/**
 * Signal Amber text field (v1.5.0-H): label above, helper and error below, never a
 * placeholder-as-label. 44px tall, 16px text (no iOS zoom), translucent amber focus
 * ring (DESIGN.md §9).
 *
 * Outline is --color-border-strong (3:1 on white) and the focus border is
 * --color-brand-strong (3:1), both decided 2026-10-09: the handoff's #ECE8DD
 * outline (1.22:1) and #D89B24 focus border (2.43:1) were too faint to see.
 *
 * Control styling (outline, focus ring, error, disabled) is shared with the bare
 * Input via `inputClassName` (./input.tsx).
 */
export type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  leadingIcon?: ReactNode;
  forceFocus?: boolean;
};

export function Field({
  id,
  label,
  helper,
  error,
  leadingIcon,
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
            inputClassName,
            leadingIcon && "pl-10",
            forceFocus && "border-(--color-brand-strong) outline-3",
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
