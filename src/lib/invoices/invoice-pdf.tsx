import path from "node:path";
import {
  Document,
  Font,
  Image,
  Link,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import QRCode from "qrcode";
import type { Invoice } from "@/lib/invoice-public";
import { brandColors, statusColors, type StatusColorKey } from "@/lib/brand-colors";
import { mempoolTxUrl } from "@/lib/btc-network";
import { WORDMARK_DOMAIN_PATH, WORDMARK_NAME_PATH, WORDMARK_VIEWBOX } from "@/lib/brand/wordmark-paths";

/*
 * Invoice PDF, Signal Amber (v1.5.5, roadmap v1.5.1-H). Mirrors the public payer
 * page: wordmark + invoice number, a summary strip (amount due, dates), parties,
 * line items with totals, and a "Pay with Bitcoin" panel. Fonts are static
 * Onest/Geist instances from src/lib/invoices/fonts (built by
 * scripts/brand/build-brand-assets.py; shipped via outputFileTracingIncludes).
 * The wordmark is drawn from Onest outlines, so it needs no font at all.
 */

const FONT_DIR = path.join(process.cwd(), "src/lib/invoices/fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONT_DIR, "Geist-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Geist-Medium.ttf"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "Geist-SemiBold.ttf"), fontWeight: 600 },
  ],
});
Font.register({ family: "Onest", src: path.join(FONT_DIR, "Onest-Bold.ttf"), fontWeight: 700 });
Font.register({ family: "GeistMono", src: path.join(FONT_DIR, "GeistMono-Regular.ttf") });
// Never hyphenate addresses, ids or names mid-word.
Font.registerHyphenationCallback((word) => [word]);

const C = brandColors;

function fmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function fmtDate(iso: string): string {
  return format(new Date(iso), "MMMM d, yyyy");
}

function fmtDueDate(iso: string): string {
  return format(new Date(iso + "T12:00:00"), "MMMM d, yyyy");
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 64,
    paddingHorizontal: 48,
    fontFamily: "Geist",
    fontSize: 10,
    lineHeight: 1.45,
    color: C.ink,
    backgroundColor: C.paper,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  wordmark: { width: 132, height: 37.7, marginLeft: -7.5 },
  headerRight: { alignItems: "flex-end" },
  // No letter-spacing or forced capitals on labels: both garble copied and
  // searched PDF text ("I NVO I C E").
  eyebrow: { fontSize: 9, fontWeight: 500, color: C.textSecondary },
  invoiceNumber: { fontFamily: "Onest", fontWeight: 700, fontSize: 20, letterSpacing: -0.4, marginTop: 2 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  pillText: { fontSize: 9, fontWeight: 500 },

  summary: {
    flexDirection: "row",
    marginTop: 28,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.canvas,
  },
  summaryCell: { flex: 1 },
  summaryAmountCell: { flex: 1.4 },
  label: { fontSize: 8.5, fontWeight: 500, color: C.textSecondary },
  amountDue: { fontFamily: "Onest", fontWeight: 700, fontSize: 22, letterSpacing: -0.4, marginTop: 3 },
  summaryValue: { fontSize: 11, fontWeight: 500, marginTop: 4 },

  parties: { flexDirection: "row", marginTop: 26 },
  party: { flex: 1, paddingRight: 16 },
  partyName: { fontSize: 11, fontWeight: 600, marginTop: 6, marginBottom: 2 },
  partyLine: { color: C.textSecondary, marginBottom: 1 },

  table: { marginTop: 26 },
  tableHead: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: C.canvas,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  colDesc: { flex: 3.2, paddingRight: 10 },
  colQty: { flex: 0.8, textAlign: "right" },
  colPrice: { flex: 1.3, textAlign: "right" },
  colTotal: { flex: 1.3, textAlign: "right" },
  cellStrong: { fontWeight: 500 },

  totals: { alignSelf: "flex-end", width: 230, marginTop: 12 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 10 },
  totalsMuted: { color: C.textSecondary },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 6,
    paddingTop: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderColor: C.ink,
  },
  grandTotalLabel: { fontSize: 11, fontWeight: 600 },
  grandTotalValue: { fontFamily: "Onest", fontWeight: 700, fontSize: 16, letterSpacing: -0.3 },

  btc: {
    flexDirection: "row",
    marginTop: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
  },
  qrFrame: {
    alignSelf: "flex-start",
    padding: 6,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    marginRight: 18,
  },
  qr: { width: 92, height: 92 },
  btcInfo: { flex: 1 },
  btcTitle: { fontFamily: "Onest", fontWeight: 700, fontSize: 13, marginBottom: 8 },
  mono: { fontFamily: "GeistMono", fontSize: 9.5, marginTop: 3, marginBottom: 10 },
  link: { color: C.ink, textDecoration: "underline", textDecorationColor: C.brand },
  note: { fontSize: 8.5, color: C.textSecondary, marginTop: 8, lineHeight: 1.45 },

  footer: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  footerText: { fontSize: 8, color: C.textSecondary },
});

function StatusPill({ status }: { status: string }) {
  const tone = statusColors[(status in statusColors ? status : "pending") as StatusColorKey];
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: tone.fill },
        status === "archived" ? { borderWidth: 1, borderColor: C.border } : {},
      ]}
    >
      <View style={[styles.pillDot, { backgroundColor: tone.dot }]} />
      <Text style={[styles.pillText, { color: tone.text }]}>{tone.label}</Text>
    </View>
  );
}

function Wordmark() {
  return (
    <Svg viewBox={WORDMARK_VIEWBOX} style={styles.wordmark}>
      <Path d={WORDMARK_NAME_PATH} fill={C.ink} />
      <Path d={WORDMARK_DOMAIN_PATH} fill={C.brand} />
    </Svg>
  );
}

interface RenderProps {
  invoice: Invoice;
  publicUrl: string;
  qrDataUrl: string | null;
}

function InvoiceDocument({ invoice, publicUrl, qrDataUrl }: RenderProps) {
  const cur = invoice.currency;
  const lineTotal = (li: Invoice["line_items"][number]) => li.quantity * li.unit_price;
  const title = invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : "Invoice";
  const isPaid = invoice.status === "paid";

  return (
    <Document title={title} author={invoice.your_name ?? undefined} creator="SatSend" producer="SatSend">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Wordmark />
          <View style={styles.headerRight}>
            <Text style={styles.eyebrow}>Invoice</Text>
            {invoice.invoice_number ? <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text> : null}
            <StatusPill status={invoice.status} />
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryAmountCell}>
            <Text style={styles.label}>{isPaid ? "Amount paid" : "Amount due"}</Text>
            <Text style={styles.amountDue}>{fmtCurrency(invoice.total_fiat, cur)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.label}>Date Created</Text>
            <Text style={styles.summaryValue}>{fmtDate(invoice.created_at)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.label}>Date Due</Text>
            <Text style={styles.summaryValue}>{invoice.due_date ? fmtDueDate(invoice.due_date) : "No due date"}</Text>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.label}>From</Text>
            {invoice.your_name ? <Text style={styles.partyName}>{invoice.your_name}</Text> : null}
            {invoice.your_company ? <Text style={styles.partyLine}>{invoice.your_company}</Text> : null}
            {invoice.your_email ? <Text style={styles.partyLine}>{invoice.your_email}</Text> : null}
            {invoice.your_address ? <Text style={styles.partyLine}>{invoice.your_address}</Text> : null}
            {invoice.your_tax_id ? <Text style={styles.partyLine}>Tax ID: {invoice.your_tax_id}</Text> : null}
          </View>
          <View style={styles.party}>
            <Text style={styles.label}>Bill to</Text>
            <Text style={styles.partyName}>{invoice.client_name}</Text>
            {invoice.client_company ? <Text style={styles.partyLine}>{invoice.client_company}</Text> : null}
            {invoice.client_email ? <Text style={styles.partyLine}>{invoice.client_email}</Text> : null}
            {invoice.client_address ? <Text style={styles.partyLine}>{invoice.client_address}</Text> : null}
            {invoice.client_tax_id ? <Text style={styles.partyLine}>Tax ID: {invoice.client_tax_id}</Text> : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead} fixed>
            <Text style={[styles.colDesc, styles.label]}>Description</Text>
            <Text style={[styles.colQty, styles.label]}>Qty</Text>
            <Text style={[styles.colPrice, styles.label]}>Unit price</Text>
            <Text style={[styles.colTotal, styles.label]}>Total</Text>
          </View>
          {invoice.line_items.map((li, idx) => (
            <View key={idx} style={styles.tableRow} wrap={false}>
              <Text style={styles.colDesc}>{li.description}</Text>
              <Text style={styles.colQty}>{li.quantity}</Text>
              <Text style={styles.colPrice}>{fmtCurrency(li.unit_price, cur)}</Text>
              <Text style={[styles.colTotal, styles.cellStrong]}>{fmtCurrency(lineTotal(li), cur)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsMuted}>Subtotal</Text>
            <Text>{fmtCurrency(invoice.subtotal_fiat, cur)}</Text>
          </View>
          {invoice.tax_percent > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsMuted}>Tax ({invoice.tax_percent}%)</Text>
              <Text>{fmtCurrency(invoice.tax_fiat, cur)}</Text>
            </View>
          ) : null}
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{fmtCurrency(invoice.total_fiat, cur)}</Text>
          </View>
        </View>

        {isPaid && invoice.btc_address ? (
          <View style={styles.btc} wrap={false}>
            <View style={styles.btcInfo}>
              <Text style={styles.btcTitle}>Paid in bitcoin</Text>
              <Text style={styles.label}>Bitcoin address</Text>
              <Text style={styles.mono}>{invoice.btc_address}</Text>
              {invoice.btc_txid ? (
                <>
                  <Text style={styles.label}>Transaction</Text>
                  <Link src={mempoolTxUrl(invoice.btc_txid)} style={[styles.link, styles.mono, { marginBottom: 0 }]}>
                    {invoice.btc_txid}
                  </Link>
                </>
              ) : null}
            </View>
          </View>
        ) : invoice.btc_address ? (
          <View style={styles.btc} wrap={false}>
            {qrDataUrl ? (
              <View style={styles.qrFrame}>
                <Image src={qrDataUrl} style={styles.qr} />
              </View>
            ) : null}
            <View style={styles.btcInfo}>
              <Text style={styles.btcTitle}>Pay with Bitcoin</Text>
              <Text style={styles.label}>Bitcoin address</Text>
              <Text style={styles.mono}>{invoice.btc_address}</Text>
              <Text style={styles.label}>View and pay online</Text>
              <Link src={publicUrl} style={[styles.link, { marginTop: 3 }]}>
                {publicUrl}
              </Link>
              <Text style={styles.note}>
                The QR code on this invoice does not encode the amount, because the bitcoin amount is set by the
                exchange rate when you pay. For the exact amount and a QR code that includes it, use the
                &quot;View and pay online&quot; link.
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 24 }} wrap={false}>
            <Text style={styles.label}>View and pay online</Text>
            <Link src={publicUrl} style={[styles.link, { marginTop: 3 }]}>
              {publicUrl}
            </Link>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Sent with SatSend · bitcoin invoicing</Text>
          <Text style={styles.footerText}>{title}</Text>
        </View>
      </Page>
    </Document>
  );
}

export interface RenderInvoicePdfOptions {
  appUrl: string;
}

export async function renderInvoicePdf(invoice: Invoice, opts: RenderInvoicePdfOptions): Promise<Buffer> {
  const publicUrl = `${opts.appUrl.replace(/\/$/, "")}/invoice/${invoice.id}`;
  const qrDataUrl = invoice.btc_address
    ? await QRCode.toDataURL(`bitcoin:${invoice.btc_address}`, {
        margin: 0,
        width: 256,
        color: { dark: C.ink, light: "#FFFFFF" },
      })
    : null;

  return renderToBuffer(<InvoiceDocument invoice={invoice} publicUrl={publicUrl} qrDataUrl={qrDataUrl} />);
}
