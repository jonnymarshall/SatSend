import { ComingSoon, comingSoonMetadata } from "@/components/marketing/coming-soon";

export const metadata = comingSoonMetadata("/security");

export default function SecurityPage() {
  return <ComingSoon path="/security" />;
}
