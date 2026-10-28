import { Column, Img, Row, Section, Text } from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";
import { statusColors } from "@/lib/brand-colors";
import {
  RATE_VARIANCE_EXPLAINED,
  formatPaymentTime,
  paymentSummary,
  type PaymentAudience,
  type PaymentSummaryInvoice,
} from "@/lib/invoices/payment-summary";
import { statusIconContentId } from "../status-icons-inline";
import { EMAIL, EmailButton, EmailLayout, EmailLink } from "./layout";

/**
 * The four payment emails (v1.5.28, roadmap v1.5.2.21-H): detected and
 * confirmed, to the client and to the sender. The same block as the client's
 * invoice page, worked out by paymentSummary, so the two always agree. Times
 * are in UTC, named: an email can't know its reader's time zone.
 */
export interface PaymentStatusEmailProps {
  audience: PaymentAudience;
  payment: PaymentSummaryInvoice;
  invoiceNumber: string | null;
  btcAddress: string;
  txid: string;
  mempoolUrl: string;
  /** The client's invoice page, or the sender's dashboard page. */
  actionUrl: string;
}

const body: CSSProperties = { fontFamily: EMAIL.body, color: EMAIL.ink, margin: 0 };

// Table cells run together in the plain-text version ("Requested$100.00"). A
// colon hidden from the HTML view separates them there; an email app that
// ignores display:none just shows "Requested: ", which still reads fine.
const PlainSep = () => <span style={{ display: "none" }}>: </span>;

function SumRow({ label, value, strong, valueColor }: { label: ReactNode; value: ReactNode; strong?: boolean; valueColor?: string }) {
  return (
    <Row>
      <Column style={{ ...body, fontSize: "15px", lineHeight: "1.5", padding: "3px 0", color: strong ? EMAIL.ink : "#4A4F5E", fontWeight: strong ? 600 : 400 }}>
        {label}
        <PlainSep />
      </Column>
      <Column align="right" style={{ ...body, fontSize: "15px", lineHeight: "1.5", padding: "3px 0", fontWeight: strong ? 600 : 400, color: valueColor ?? EMAIL.ink }}>
        {value}
      </Column>
    </Row>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Row>
      <Column style={{ ...body, fontSize: "14px", lineHeight: "1.5", padding: "5px 16px 5px 0", color: EMAIL.textSecondary, width: "110px", verticalAlign: "top" }}>
        {label}
        <PlainSep />
      </Column>
      <Column align="right" style={{ ...body, fontSize: "14px", lineHeight: "1.5", padding: "5px 0", verticalAlign: "top" }}>
        {children}
      </Column>
    </Row>
  );
}

export function PaymentStatusEmail({ audience, payment, invoiceNumber, btcAddress, txid, mempoolUrl, actionUrl }: PaymentStatusEmailProps) {
  const summary = paymentSummary(payment, { audience });
  const { state, sums, message, time } = summary;
  const colors = statusColors[state];
  const sender = payment.your_company || payment.your_name || "the sender";
  const client = payment.client_company || payment.client_name || "your client";
  const context =
    audience === "client"
      ? `${invoiceNumber ? `Invoice ${invoiceNumber}` : "An invoice"} from ${sender}`
      : `${invoiceNumber ? `Invoice ${invoiceNumber}` : "Your invoice"} to ${client}`;
  const mono: CSSProperties = { fontFamily: EMAIL.mono, fontSize: "13px", wordBreak: "break-all" };

  return (
    <EmailLayout preview={`${summary.heading}: ${context}`}>
      <Section style={{ textAlign: "center" }}>
        <Img
          src={`cid:${statusIconContentId(state)}`}
          width="64"
          height="64"
          alt=""
          style={{ display: "block", margin: "0 auto 12px", border: 0 }}
        />
        <Text style={{ fontFamily: EMAIL.display, fontSize: "26px", lineHeight: "1.2", fontWeight: 600, letterSpacing: "-0.02em", color: colors.text, margin: "0 0 6px" }}>
          {summary.heading}
        </Text>
        <Text style={{ ...body, fontSize: "15px", lineHeight: "1.5", color: EMAIL.textSecondary, margin: "0 0 20px" }}>{context}</Text>
      </Section>

      {sums && (
        <Section style={{ backgroundColor: colors.fill, borderRadius: "10px", padding: "14px 16px", margin: "0 0 16px" }}>
          <SumRow label="Requested" value={sums.requested} />
          <SumRow
            label="Received"
            value={
              <>
                {sums.received}
                {sums.receivedBtc && <span style={{ color: "#4A4F5E", fontSize: "13px" }}> ({sums.receivedBtc})</span>}
              </>
            }
          />
          {sums.rateVariance && <SumRow label="Exchange Rate Variance" value={sums.rateVariance} />}
          <Section style={{ borderTop: "1px solid rgba(21, 28, 46, 0.1)", marginTop: "6px", paddingTop: "6px" }}>
            <SumRow label="Outstanding" value={sums.outstanding} strong valueColor={colors.text} />
          </Section>
        </Section>
      )}

      {sums?.rateVariance && (
        <Text style={{ ...body, fontSize: "13px", lineHeight: "1.5", color: EMAIL.textSecondary, margin: "0 0 16px" }}>
          <strong style={{ color: EMAIL.ink, fontWeight: 600 }}>Exchange Rate Variance:</strong> {RATE_VARIANCE_EXPLAINED.join(" ")}
        </Text>
      )}

      {message && (
        <Text style={{ ...body, fontSize: "15px", lineHeight: "1.55", color: EMAIL.textSecondary, margin: "0 0 16px", textAlign: sums ? "left" : "center" }}>
          {message}
        </Text>
      )}

      <Section style={{ borderTop: `1px solid ${EMAIL.border}`, paddingTop: "12px" }}>
        {time && (
          <DetailRow label={time.label}>
            <span style={{ fontWeight: 500 }}>{formatPaymentTime(time.iso, "UTC")}</span>
          </DetailRow>
        )}
        <DetailRow label="Address">
          <span style={mono}>{btcAddress}</span>
        </DetailRow>
        <DetailRow label="Transaction">
          <span style={mono}>
            <EmailLink href={mempoolUrl}>{txid}</EmailLink>
          </span>
        </DetailRow>
      </Section>

      <EmailButton href={actionUrl}>{audience === "client" ? "View invoice" : "Open in SatSend"}</EmailButton>
    </EmailLayout>
  );
}
