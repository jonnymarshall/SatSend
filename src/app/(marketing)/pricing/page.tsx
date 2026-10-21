import { ComingSoon, comingSoonMetadata } from "@/components/marketing/coming-soon";

export const metadata = comingSoonMetadata("/pricing");

export default function PricingPage() {
  return <ComingSoon path="/pricing" />;
}
