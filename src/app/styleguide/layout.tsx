import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isUiKitEnabled } from "./kit-flag";

export const metadata: Metadata = {
  title: "UI kit (internal) · SatSend",
  robots: { index: false, follow: false },
};

export default function StyleguideLayout({ children }: { children: React.ReactNode }) {
  if (!isUiKitEnabled()) notFound();
  return (
    <div id="styleguide" data-theme="signal-amber" className="min-h-dvh w-full">
      {children}
    </div>
  );
}
