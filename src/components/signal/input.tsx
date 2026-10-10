import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Signal Amber control styling (v1.5-H), shared by the bare Input, Field, and the
 * app's own <input>/<textarea>/<select> elements so every text control looks the
 * same. 44px tall, 16px text (no iOS zoom), translucent amber focus ring
 * (DESIGN.md §9).
 *
 * Outline is --color-border-strong (3:1 on white) and the focus border is
 * --color-brand-strong (3:1), both decided 2026-10-09.
 *
 * The ring colour is set in the resting state, not only under :focus-visible, so
 * focusing changes the ring's width and never animates its colour.
 *
 * `aria-invalid` switches to the danger border, so callers only set the attribute.
 */
export const controlClassName = cn(
  "w-full rounded-(--radius-md) border bg-(--color-surface) px-3.5 text-base text-(--color-ink)",
  "border-(--color-border-strong) outline-offset-1 outline-[rgba(216,155,36,0.22)]",
  "placeholder:text-(--color-text-secondary) transition-[border-color] duration-150",
  "focus-visible:border-(--color-brand-strong) focus-visible:outline-3",
  "aria-invalid:border-(--color-danger) aria-invalid:outline-[rgba(217,95,95,0.2)] aria-invalid:focus-visible:border-(--color-danger)",
  "disabled:cursor-not-allowed disabled:bg-(--color-neutral-soft) disabled:text-(--color-text-secondary)",
);

/** Single-line text control: 44px tall. */
export const inputClassName = cn("h-11", controlClassName);

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClassName, className)} {...props} />;
}
