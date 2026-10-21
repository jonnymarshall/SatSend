import { ComingSoon, comingSoonMetadata } from "@/components/marketing/coming-soon";

export const metadata = comingSoonMetadata("/faq");

export default function FaqPage() {
  return <ComingSoon path="/faq" />;
}
