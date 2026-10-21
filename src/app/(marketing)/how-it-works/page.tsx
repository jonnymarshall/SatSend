import { ComingSoon, comingSoonMetadata } from "@/components/marketing/coming-soon";

export const metadata = comingSoonMetadata("/how-it-works");

export default function HowItWorksPage() {
  return <ComingSoon path="/how-it-works" />;
}
