import { ComingSoon, comingSoonMetadata } from "@/components/marketing/coming-soon";

export const metadata = comingSoonMetadata("/about");

export default function AboutPage() {
  return <ComingSoon path="/about" />;
}
