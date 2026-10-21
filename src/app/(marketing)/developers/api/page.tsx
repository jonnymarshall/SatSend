import { ComingSoon, comingSoonMetadata } from "@/components/marketing/coming-soon";

export const metadata = comingSoonMetadata("/developers/api");

export default function DevelopersApiPage() {
  return <ComingSoon path="/developers/api" />;
}
