import { ComingSoon, comingSoonMetadata } from "@/components/marketing/coming-soon";

export const metadata = comingSoonMetadata("/terms");

export default function TermsPage() {
  return <ComingSoon path="/terms" />;
}
