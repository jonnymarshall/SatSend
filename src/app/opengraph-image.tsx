import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/*
 * Link-preview image for every page (v1.5.16; restyled v1.5.17): the card chat
 * apps and social sites show when a satsend.me link is shared. Built like the
 * homepage hero: the SatSend.me wordmark, the small caps label, and the ink and
 * amber headline, in Onest and Geist.
 *
 * ImageResponse can't use web fonts or CSS variables, so the fonts are read from
 * the files the invoice PDF already ships (next.config.ts traces them for this
 * route) and the colours are the brand tokens inlined.
 */

export const alt = "SatSend: Invoice in bitcoin. Paid straight to your wallet.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const OG_FONT_FILES = [
  "src/lib/invoices/fonts/Onest-Bold.ttf",
  "src/lib/invoices/fonts/Geist-Medium.ttf",
  "src/lib/invoices/fonts/Geist-SemiBold.ttf",
];

const INK = "#151C2E";
const CANVAS = "#FCFBF7";
const BRAND = "#D89B24";
const BRAND_STRONG = "#BC8925";
const TEXT_SECONDARY = "#6F7282";

const font = (file: string) => readFile(path.join(process.cwd(), file));

export default async function OpengraphImage() {
  const [onestBold, geistMedium, geistSemiBold] = await Promise.all(OG_FONT_FILES.map(font));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: CANVAS,
          color: INK,
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", padding: "72px 88px 0" }}>
          {/* Wordmark: same proportions as SatSendLogo (72 / 42, tracking -4.3 / -1.4). */}
          <div style={{ display: "flex", alignItems: "baseline", fontFamily: "Onest" }}>
            <span style={{ fontSize: 56, letterSpacing: -3.3, color: INK }}>SatSend</span>
            <span style={{ fontSize: 33, letterSpacing: -1.1, color: BRAND, marginLeft: 1 }}>.me</span>
          </div>

          <div
            style={{
              marginTop: 64,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 2,
              color: TEXT_SECONDARY,
              textTransform: "uppercase",
            }}
          >
            Bitcoin invoicing for independent professionals
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 22,
              fontFamily: "Onest",
              fontSize: 80,
              lineHeight: 1.04,
              letterSpacing: -2.4,
            }}
          >
            <span style={{ color: INK }}>Invoice in bitcoin.</span>
            <span style={{ color: BRAND_STRONG }}>Paid straight to your wallet.</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", padding: "0 88px 40px", fontSize: 26, fontWeight: 500, color: TEXT_SECONDARY }}>
            Non-custodial · Zero transaction fees · Nothing to set up
          </div>
          <div style={{ display: "flex", height: 14, background: BRAND }} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Onest", data: onestBold, weight: 700, style: "normal" },
        { name: "Geist", data: geistMedium, weight: 500, style: "normal" },
        { name: "Geist", data: geistSemiBold, weight: 600, style: "normal" },
      ],
    },
  );
}
