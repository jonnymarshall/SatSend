import type { SVGProps } from "react";

/*
 * Lucide `banknote-check` (lucide-static v1.60.0, ISC licence), copied because
 * the installed lucide-react (1.8) predates it. After upgrading lucide-react,
 * replace this with `import { BanknoteCheck } from "lucide-react"`.
 */
export function BanknoteCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M11.748 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4.875" />
      <path d="m16 19 2 2 4-4" />
      <path d="M18 12h.01" />
      <path d="M6 12h.01" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
