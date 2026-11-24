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

  // v1.5.31: the link holds a SatSend reference or an old UUID; the access
  // cookie is always named for the UUID, so an unlock on one link form opens
  // the other. The code screen keeps the link the client came in on.
  const cookieStore = await cookies();
  const storedCode = cookieStore.get(accessCookieName(invoice.id))?.value ?? null;

  if (!hasAccess(invoice.id, invoice.access_code, storedCode)) {
    return <AccessCodeGate invoiceKey={id} />;
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
