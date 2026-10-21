import { ComingSoon, comingSoonMetadata } from "@/components/marketing/coming-soon";

export const metadata = comingSoonMetadata("/coming-soon");

export default function ComingSoonPage() {
  return <ComingSoon path="/coming-soon" />;
}
