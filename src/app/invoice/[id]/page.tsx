import { Suspense } from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { fetchPublicInvoice, toPublicInvoice, type Invoice } from "@/lib/invoice-public";
import { fetchBtcPrice } from "@/lib/btc-price";
import { hasAccess, accessCookieName } from "@/lib/access-code";
import { AccessCodeGate } from "./access-code-gate";
import { InvoiceLoading } from "./invoice-loading";
import { InvoicePaymentView } from "./invoice-payment-view";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientInvoicePage({ params }: Props) {
  const { id } = await params;

  const invoice = await fetchPublicInvoice(id);
  if (!invoice) notFound();

  const cookieStore = await cookies();
  const storedCode = cookieStore.get(accessCookieName(id))?.value ?? null;

  if (!hasAccess(id, invoice.access_code, storedCode)) {
    return <AccessCodeGate invoiceId={id} />;
  }

  // v1.5.30 (roadmap v1.5.2.23-H): everything above runs before the response
  // starts, so an unknown link answers a real 404. The spinner covers only the
  // slow part, the bitcoin price; a route-level loading.tsx would stream the
  // whole page and force a 200, even for a link that matches no invoice.
  return (
    <Suspense fallback={<InvoiceLoading />}>
      <PricedInvoiceView invoice={invoice} />
    </Suspense>
  );
}

async function PricedInvoiceView({ invoice }: { invoice: Invoice }) {
  let btcPrice: number | null = null;
  if (invoice.btc_address) {
    try {
      const result = await fetchBtcPrice(invoice.currency);
      btcPrice = result.price;
    } catch {
      // BTC price unavailable — show fallback in view
    }
  }

  return <InvoicePaymentView invoice={toPublicInvoice(invoice)} btcPrice={btcPrice} />;
}
