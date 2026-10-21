import { ImageResponse } from "next/og";

// Link-preview image for every page (v1.5.16): wordmark and tagline on the
// Signal Amber canvas. Colours are the brand tokens, inlined because
// ImageResponse can't read CSS variables.
export const alt = "SatSend: Bitcoin invoicing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#FCFBF7",
          color: "#151C2E",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "#D89B24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 64,
              fontWeight: 800,
              color: "#151C2E",
            }}
          >
            S
          </div>
          <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -3 }}>SatSend</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 52, fontWeight: 700 }}>Bitcoin invoicing</div>
        <div style={{ marginTop: 16, fontSize: 34, color: "#6F7282" }}>
          Paid straight to your wallet. Non-custodial, zero transaction fees.
        </div>
      </div>
    ),
    size,
  );
}
