import { cn } from "@/lib/utils";

/** Signal Amber loading spinner: warm-neutral track, amber head (v1.5-H). */
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "size-8 animate-spin rounded-full border-[3px] border-(--color-border) border-t-(--color-brand-strong) motion-reduce:animate-none",
        className,
      )}
    />
  );
}
