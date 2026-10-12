import Link from "next/link";
import type { CSSProperties } from "react";
import { SatSendLogo } from "./satsend-logo";

/**
 * The SatSend logo as a link to the homepage. Every logo in the app and on
 * client-facing pages goes to `/` (v1.5.6).
 */
export function LogoHomeLink({
  id,
  className = "",
  logoStyle,
}: {
  id: string;
  className?: string;
  logoStyle?: CSSProperties;
}) {
  return (
    <Link
      id={id}
      href="/"
      aria-label="SatSend, go to homepage"
      className={`-mx-1 inline-flex min-h-11 items-center rounded-(--radius-sm) px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ink) ${className}`}
    >
      <SatSendLogo aria-hidden style={logoStyle} />
    </Link>
  );
}
