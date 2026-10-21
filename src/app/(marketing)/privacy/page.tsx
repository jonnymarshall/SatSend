import { ComingSoon, comingSoonMetadata } from "@/components/marketing/coming-soon";

export const metadata = comingSoonMetadata("/privacy");

export default function PrivacyPage() {
  return <ComingSoon path="/privacy" />;
}
