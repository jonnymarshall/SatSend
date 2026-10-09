import type { SVGProps } from "react";

/**
 * SatSend app icon / favicon mark (v1.5.0-H), built from
 * satsend-brand-handoff/assets/satsend-favicon.svg. `dark` is the handoff asset;
 * `light` is the light-surface variant shown on the reference board.
 * Requires Onest (text-based, like the wordmark).
 */
export function SatSendMark({
  variant = "dark",
  ...props
}: SVGProps<SVGSVGElement> & { variant?: "dark" | "light" }) {
  const dark = variant === "dark";
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="SatSend" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="15"
        fill={dark ? "var(--color-ink, #151C2E)" : "var(--color-surface, #FFFFFF)"}
        stroke={dark ? "none" : "var(--color-border, #ECE8DD)"}
        strokeWidth={dark ? 0 : 1.5}
      />
      <text
        x="14"
        y="44"
        fontFamily='"Onest", Arial, sans-serif'
        fontSize="38"
        fontWeight="800"
        letterSpacing="-2"
        fill={dark ? "var(--color-canvas, #FCFBF7)" : "var(--color-ink, #151C2E)"}
      >
        S
      </text>
      <circle cx="48" cy="43" r="5" fill="var(--color-brand, #D89B24)" />
    </svg>
  );
}
