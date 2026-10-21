import { ComingSoon, comingSoonMetadata } from "@/components/marketing/coming-soon";

export const metadata = comingSoonMetadata("/contact");

export default function ContactPage() {
  return <ComingSoon path="/contact" />;
}
