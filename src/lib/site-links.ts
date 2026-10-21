/**
 * Every link on the marketing site, in one place (v1.5.16, roadmap v1.5.2-H).
 *
 * Pages that aren't built yet are listed in PLACEHOLDER_PAGES and render a
 * "Coming soon" page at their real address, so no link is ever dead. Each one is
 * its own roadmap item before launch.
 *
 * SOCIAL_LINKS point at /coming-soon until the SatSend accounts exist (roadmap:
 * "Create SatSend accounts on X, LinkedIn and GitHub"). Swap in the real URL here.
 */

export type SiteLink = { label: string; href: string };

export const SOCIAL_LINKS = {
  x: "/coming-soon",
  linkedin: "/coming-soon",
  github: "/coming-soon",
} as const;

export const PLACEHOLDER_PAGES = [
  { path: "/how-it-works", title: "How it works", description: "How SatSend takes you from invoice to bitcoin in your wallet." },
  { path: "/pricing", title: "Pricing", description: "SatSend's Free and Pro plans." },
  { path: "/faq", title: "FAQ", description: "Answers to common questions about SatSend." },
  { path: "/security", title: "Security", description: "How SatSend keeps your invoices safe, and why it never holds your bitcoin." },
  { path: "/about", title: "About", description: "Who's behind SatSend, and why it exists." },
  { path: "/contact", title: "Contact", description: "How to get in touch with SatSend." },
  { path: "/privacy", title: "Privacy policy", description: "What SatSend stores and why." },
  { path: "/terms", title: "Terms of service", description: "The terms for using SatSend." },
  { path: "/developers/api", title: "API", description: "The SatSend API." },
  { path: "/coming-soon", title: "Coming soon", description: "This part of SatSend is on its way." },
] as const;

export const NAV_LINKS: SiteLink[] = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
];

export const FOOTER_COLUMNS: { heading: string; links: SiteLink[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/faq" },
      { label: "Security", href: "/security" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Developers",
    links: [
      { label: "GitHub", href: SOCIAL_LINKS.github },
      { label: "API", href: "/developers/api" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
    ],
  },
];
