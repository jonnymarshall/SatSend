import { Document, Page, Text, View, StyleSheet, Image, Link, renderToBuffer } from "@react-pdf/renderer";
import { format } from "date-fns";
import QRCode from "qrcode";
import type { Invoice } from "@/lib/invoice-public";
import { brandColors } from "@/lib/brand-colors";

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
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: brandColors.foreground,
    backgroundColor: brandColors.paper,
  },
  headerBand: {
    backgroundColor: brandColors.primary,
    paddingHorizontal: 40,
    paddingVertical: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    color: "#FFFFFF",
  },
  title: { fontSize: 26, fontWeight: 700, color: "#FFFFFF", letterSpacing: 2 },
  invoiceNumber: { fontSize: 12, color: "#FFFFFF" },
  body: { paddingHorizontal: 40, paddingTop: 24 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  metaCell: { width: "48%" },
  metaLabel: {
    fontSize: 8,
    color: brandColors.muted,
    fontWeight: 700,
    marginBottom: 4,
  },
  metaValue: { fontSize: 11, marginBottom: 6 },
  publicLink: { color: brandColors.primary, fontSize: 9, textDecoration: "underline" },
  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  party: { width: "48%" },
  partyLabel: {
    fontSize: 8,
    color: brandColors.muted,
    fontWeight: 700,
    marginBottom: 4,
  },
  partyLine: { marginBottom: 2 },
  itemsHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: brandColors.primary,
    paddingBottom: 6,
    marginBottom: 6,
  },
  itemsHeaderText: { fontSize: 8, color: brandColors.muted, fontWeight: 700 },
  itemRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E5E5",
  },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1, textAlign: "right" },
  totalsBlock: { marginTop: 12, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", width: 220, justifyContent: "space-between", marginBottom: 3 },
  grandTotalRow: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1.5,
    borderTopColor: brandColors.primary,
  },
  grandTotalText: { fontSize: 13, fontWeight: 700, color: brandColors.primary },
  btcBlock: {
    marginTop: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: brandColors.primary,
    borderRadius: 4,
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  btcQr: { width: 96, height: 96 },
  btcInfo: { flex: 1 },
  btcLabel: {
    fontSize: 9,
    color: brandColors.primary,
    marginBottom: 6,
    fontWeight: 700,
  },
  mono: { fontFamily: "Courier", fontSize: 10, marginBottom: 8 },
  btcNote: { fontSize: 9, color: brandColors.foreground, marginBottom: 4, lineHeight: 1.4 },
});

interface RenderProps {
  invoice: Invoice;
  publicUrl: string;
  qrDataUrl: string | null;
}

function InvoiceDocument({ invoice, publicUrl, qrDataUrl }: RenderProps) {
  const lineTotal = (li: Invoice["line_items"][number]) => li.quantity * li.unit_price;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBand}>
          <Text style={styles.title}>INVOICE</Text>
          {invoice.invoice_number ? <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text> : null}
        </View>

        <View style={styles.body}>
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Date Created</Text>
              <Text style={styles.metaValue}>{fmtDate(invoice.created_at)}</Text>
              <Text style={styles.metaLabel}>Date Due</Text>
              <Text style={styles.metaValue}>
                {invoice.due_date ? fmtDueDate(invoice.due_date) : "No due date"}
              </Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>View and pay online</Text>
              <Link src={publicUrl} style={styles.publicLink}>{publicUrl}</Link>
            </View>
          </View>

          <View style={styles.partiesRow}>
            <View style={styles.party}>
              <Text style={styles.partyLabel}>From</Text>
              {invoice.your_name ? <Text style={styles.partyLine}>{invoice.your_name}</Text> : null}
              {invoice.your_company ? <Text style={styles.partyLine}>{invoice.your_company}</Text> : null}
              {invoice.your_email ? <Text style={styles.partyLine}>{invoice.your_email}</Text> : null}
              {invoice.your_address ? <Text style={styles.partyLine}>{invoice.your_address}</Text> : null}
              {invoice.your_tax_id ? <Text style={styles.partyLine}>Tax ID: {invoice.your_tax_id}</Text> : null}
            </View>
            <View style={styles.party}>
              <Text style={styles.partyLabel}>Bill to</Text>
              <Text style={styles.partyLine}>{invoice.client_name}</Text>
              {invoice.client_company ? <Text style={styles.partyLine}>{invoice.client_company}</Text> : null}
              {invoice.client_email ? <Text style={styles.partyLine}>{invoice.client_email}</Text> : null}
              {invoice.client_address ? <Text style={styles.partyLine}>{invoice.client_address}</Text> : null}
              {invoice.client_tax_id ? <Text style={styles.partyLine}>Tax ID: {invoice.client_tax_id}</Text> : null}
            </View>
          </View>

          <View style={styles.itemsHeader}>
            <Text style={[styles.colDesc, styles.itemsHeaderText]}>Description</Text>
            <Text style={[styles.colQty, styles.itemsHeaderText]}>Qty</Text>
            <Text style={[styles.colPrice, styles.itemsHeaderText]}>Unit price</Text>
            <Text style={[styles.colTotal, styles.itemsHeaderText]}>Total</Text>
          </View>
          {invoice.line_items.map((li, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.colDesc}>{li.description}</Text>
              <Text style={styles.colQty}>{li.quantity}</Text>
              <Text style={styles.colPrice}>{fmtCurrency(li.unit_price, invoice.currency)}</Text>
              <Text style={styles.colTotal}>{fmtCurrency(lineTotal(li), invoice.currency)}</Text>
            </View>
          ))}

          <View style={styles.totalsBlock}>
            <View style={styles.totalsRow}>
              <Text>Subtotal</Text>
              <Text>{fmtCurrency(invoice.subtotal_fiat, invoice.currency)}</Text>
            </View>
            {invoice.tax_percent > 0 ? (
              <View style={styles.totalsRow}>
                <Text>Tax ({invoice.tax_percent}%)</Text>
                <Text>{fmtCurrency(invoice.tax_fiat, invoice.currency)}</Text>
              </View>
            ) : null}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalText}>Total</Text>
              <Text style={styles.grandTotalText}>{fmtCurrency(invoice.total_fiat, invoice.currency)}</Text>
            </View>
          </View>

          {invoice.btc_address ? (
            <View style={styles.btcBlock}>
              {qrDataUrl ? <Image src={qrDataUrl} style={styles.btcQr} /> : null}
              <View style={styles.btcInfo}>
                <Text style={styles.btcLabel}>Pay with Bitcoin</Text>
                <Text style={styles.mono}>{invoice.btc_address}</Text>
                <Text style={styles.btcNote}>
                  Please note: the Bitcoin QR code on this invoice does not encode the amount. For a simpler payment
                  experience, visit the &quot;View and pay online&quot; link above.
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

export interface RenderInvoicePdfOptions {
  appUrl: string;
}

export async function renderInvoicePdf(
  invoice: Invoice,
  opts: RenderInvoicePdfOptions
): Promise<Buffer> {
  const publicUrl = `${opts.appUrl.replace(/\/$/, "")}/invoice/${invoice.id}`;
  const qrDataUrl = invoice.btc_address
    ? await QRCode.toDataURL(`bitcoin:${invoice.btc_address}`, {
        margin: 0,
        width: 256,
        color: { dark: brandColors.foreground, light: "#FFFFFF" },
      })
    : null;

  return renderToBuffer(
    <InvoiceDocument invoice={invoice} publicUrl={publicUrl} qrDataUrl={qrDataUrl} />
  );
}
