import type { Metadata } from "next";
import { Onest } from "next/font/google";
import { notFound } from "next/navigation";
import "@/styles/signal-amber.css";
import { isUiKitEnabled } from "./kit-flag";

// Onest is the Signal Amber display/logo face (DESIGN.md §4). Loaded only here for
// now; v1.5-H moves it to the root layout.
const onest = Onest({ subsets: ["latin"], variable: "--font-onest" });

export const metadata: Metadata = {
  title: "UI kit (internal) · SatSend",
  robots: { index: false, follow: false },
};

export default function StyleguideLayout({ children }: { children: React.ReactNode }) {
  if (!isUiKitEnabled()) notFound();
  return (
    <div id="styleguide" data-theme="signal-amber" className={`${onest.variable} min-h-dvh w-full`}>
      {children}
    </div>
  );
}
