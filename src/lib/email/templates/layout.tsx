import { Body, Container, Head, Html, Img, Link, Preview, Section, Text } from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";
import { getAppUrl } from "@/lib/app-url";
import { statusColors } from "@/lib/brand-colors";
import { LOGO_CONTENT_ID } from "../logo-inline";

/**
 * Signal Amber email frame (v1.5.5, roadmap v1.5.1-H). Email apps ignore
 * stylesheets and web fonts, so everything is inline and the fonts fall back to
 * system faces. Colours are the Signal Amber tokens (src/styles/signal-amber.css),
 * using the AA text shades for coloured text.
 */
export const EMAIL = {
  ink: "#151C2E",
  canvas: "#FCFBF7",
  surface: "#FFFFFF",
  brand: "#D89B24",
  textSecondary: "#6F7282",
  border: "#ECE8DD",
  display: "Onest, 'Helvetica Neue', Helvetica, Arial, sans-serif",
  body: "Geist, -apple-system, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  mono: "'Geist Mono', ui-monospace, Menlo, Consolas, monospace",
} as const;

/**
 * Where an email that can't carry the inline logo (the Supabase auth templates)
 * loads it from. Email apps (and Gmail's image proxy) cannot reach localhost, so
 * local dev borrows the live site's copy of the same file.
 */
export function emailLogoUrl(appUrl: string = getAppUrl()): string {
  const base = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(appUrl) ? "https://satsend.me" : appUrl;
  return `${base}/brand/satsend-logo-email.png`;
}

export type EmailStatus = "pending" | "payment_detected" | "paid" | "underpaid";

const text: CSSProperties = {
  fontFamily: EMAIL.body,
  fontSize: "16px",
  lineHeight: "1.55",
  color: EMAIL.ink,
  margin: "0 0 16px",
};

export function EmailLayout({
  preview,
  children,
  appUrl = getAppUrl(),
  logoSrc = `cid:${LOGO_CONTENT_ID}`,
}: {
  preview: string;
  children: ReactNode;
  /** Fixed site for emails built ahead of time (the Supabase auth templates). */
  appUrl?: string;
  /**
   * Defaults to the logo attached inline by send.ts (v1.5.12). Emails sent by
   * someone else (Supabase) can't carry the attachment and pass a web address.
   */
  logoSrc?: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: EMAIL.canvas, margin: 0, padding: "24px 6px" }}>
        {/* Wide enough that a 64-character txid fits on one line (Jonny, v1.5.7). */}
        <Container style={{ maxWidth: "720px", margin: "0 auto" }}>
          <Section style={{ padding: "0 4px 20px" }}>
            <Link href={appUrl}>
              <Img
                src={logoSrc}
                width="132"
                height="38"
                alt="SatSend"
                style={{ display: "block", border: 0 }}
              />
            </Link>
          </Section>
          <Section
            style={{
              backgroundColor: EMAIL.surface,
              border: `1px solid ${EMAIL.border}`,
              borderRadius: "16px",
              padding: "32px 28px",
            }}
          >
            {children}
          </Section>
          <Text style={{ ...text, fontSize: "12px", color: EMAIL.textSecondary, margin: "20px 4px 0" }}>
            Sent with SatSend · bitcoin invoicing
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailHeading({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: EMAIL.display,
        fontSize: "24px",
        lineHeight: "1.25",
        fontWeight: 700,
        letterSpacing: "-0.02em",
        color: EMAIL.ink,
        margin: "0 0 16px",
      }}
    >
      {children}
    </Text>
  );
}

export function EmailText({ children, muted, small }: { children: ReactNode; muted?: boolean; small?: boolean }) {
  return (
    <Text
      style={{
        ...text,
        ...(muted ? { color: EMAIL.textSecondary } : null),
        ...(small ? { fontSize: "14px", lineHeight: "1.45" } : null),
      }}
    >
      {children}
    </Text>
  );
}

/** Primary action: amber with ink text (white on amber fails contrast, DESIGN.md §12). */
export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: "24px 0 8px" }}>
      <Link
        href={href}
        style={{
          display: "inline-block",
          backgroundColor: EMAIL.brand,
          color: EMAIL.ink,
          fontFamily: EMAIL.body,
          fontSize: "16px",
          fontWeight: 600,
          textDecoration: "none",
          padding: "13px 24px",
          borderRadius: "10px",
        }}
      >
        {children}
      </Link>
    </Section>
  );
}

/** Text link: ink with an amber underline (amber text is too faint to read). */
export function EmailLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        color: EMAIL.ink,
        textDecoration: "underline",
        textDecorationColor: EMAIL.brand,
        textUnderlineOffset: "3px",
        wordBreak: "break-all",
      }}
    >
      {children}
    </Link>
  );
}

export function StatusPill({ status }: { status: EmailStatus }) {
  const t = statusColors[status];
  return (
    <Text style={{ margin: "0 0 16px" }}>
      <span
        style={{
          display: "inline-block",
          backgroundColor: t.fill,
          color: t.text,
          fontFamily: EMAIL.body,
          fontSize: "13px",
          fontWeight: 500,
          lineHeight: "1",
          padding: "7px 11px",
          borderRadius: "999px",
        }}
      >
        <span style={{ color: t.dot }}>●</span>&nbsp; {t.label}
      </span>
    </Text>
  );
}

/** A canvas-coloured panel for the key amount and details. */
export function Panel({ children }: { children: ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: EMAIL.canvas,
        border: `1px solid ${EMAIL.border}`,
        borderRadius: "10px",
        padding: "16px 18px",
        margin: "8px 0 20px",
      }}
    >
      {children}
    </Section>
  );
}

export function PanelRow({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <Text style={{ ...text, fontSize: "14px", margin: "0 0 4px" }}>
      <span style={{ color: EMAIL.textSecondary }}>{label}</span>
      <br />
      <span style={strong ? { fontFamily: EMAIL.display, fontSize: "22px", fontWeight: 700 } : { fontWeight: 500 }}>
        {value}
      </span>
    </Text>
  );
}

export function TxidLine({ txid }: { txid: string }) {
  return (
    <Text
      style={{
        fontFamily: EMAIL.mono,
        fontSize: "12px",
        lineHeight: "1.5",
        color: EMAIL.textSecondary,
        wordBreak: "break-all",
        margin: "0 0 16px",
      }}
    >
      Txid: {txid}
    </Text>
  );
}
