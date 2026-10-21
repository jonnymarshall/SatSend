import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Onest } from "next/font/google";
import { getAppUrl } from "@/lib/app-url";
import "./globals.css";
import "@/styles/signal-amber.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Onest is the Signal Amber display/logo face (DESIGN.md §4); Geist is the UI face.
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Makes link-preview image URLs absolute (https://satsend.me/... in production).
  metadataBase: new URL(getAppUrl()),
  title: "SatSend",
  description: "Bitcoin invoicing for independent professionals. Non-custodial: paid straight to your wallet.",
};

export const viewport: Viewport = {
  themeColor: "#FCFBF7",
};

// Light-first since v1.5-H: no `dark` class. The palette lives in
// src/styles/signal-amber.css and globals.css aliases shadcn's variables onto it.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${onest.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
