import type { SVGProps } from "react";

export type SatSendLogoVariant =
  | "default"
  | "reversed"
  | "monochrome";

export type SatSendLogoProps = SVGProps<SVGSVGElement> & {
  variant?: SatSendLogoVariant;
};

/**
 * SatSend wordmark.
 *
 * IMPORTANT:
 * - Keep this component in sync with assets/satsend-logo.svg.
 * - Onest must be loaded by the application.
 * - The `.me` spacing is intentionally tightened with dx="-1.5".
 * - Do not replace this with two independently positioned HTML spans.
 */
export function SatSendLogo({
  variant = "default",
  style,
  ...props
}: SatSendLogoProps) {
  const reversed = variant === "reversed";
  const monochrome = variant === "monochrome";

  const nameColor = reversed
    ? "var(--color-canvas, #FCFBF7)"
    : "var(--color-ink, #151C2E)";

  const domainColor = monochrome
    ? nameColor
    : "var(--color-brand, #D89B24)";

  return (
    <svg
      viewBox="0 0 420 120"
      role="img"
      aria-label="SatSend"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        ...style,
      }}
      {...props}
    >
      <text
        x="24"
        y="82"
        fontFamily='"Onest", Arial, sans-serif'
        dominantBaseline="alphabetic"
      >
        <tspan
          fill={nameColor}
          fontSize="72"
          fontWeight="750"
          letterSpacing="-4.3"
        >
          SatSend
        </tspan>
        <tspan
          dx="-1.5"
          fill={domainColor}
          fontSize="42"
          fontWeight="700"
          letterSpacing="-1.4"
        >
          .me
        </tspan>
      </text>
    </svg>
  );
}
